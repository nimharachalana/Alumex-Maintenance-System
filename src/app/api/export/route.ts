import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const plant = searchParams.get('plant') || 'ALL'; // ALL, EXTRUSION, VPC

    const whereStation: any = {};
    if (plant !== 'ALL') {
      whereStation.plant = plant;
    }

    const stations = await db.station.findMany({
      where: whereStation,
      include: {
        checkpoints: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    const inspections = await db.inspection.findMany({
      where: { month },
      include: {
        items: {
          include: {
            checkpoint: true,
          },
        },
        user: true,
        station: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    // ==========================================
    // 1. SHEET 1: Master Monthly Verification Grid
    // ==========================================
    const headerRow = ['Plant', 'Station Code', 'Station Name', 'Equipment', 'Item', 'Look For Standard'];
    for (let d = 1; d <= 31; d++) {
      headerRow.push(`Day ${d}`);
    }

    const rows: any[][] = [headerRow];

    for (const st of stations) {
      for (const cp of st.checkpoints) {
        const rowData = [
          st.plant === 'EXTRUSION' ? 'Extrusion Plant (CH/MT/102)' : 'VPC Plant (LS/MT/102)',
          st.code,
          st.name,
          cp.equipmentName,
          cp.itemName,
          cp.lookForCriteria,
        ];

        for (let d = 1; d <= 31; d++) {
          const sub = inspections.find((s) => s.stationId === st.id && s.day === d);
          let val = '-';
          if (sub) {
            const item = sub.items.find((i) => i.checkpointId === cp.id);
            if (item) val = item.status;
          }
          rowData.push(val);
        }

        rows.push(rowData);
      }

      // Add prominent Technician Sign-off / EPF row for this station across Days 1-31
      const techRow = [
        st.plant === 'EXTRUSION' ? 'Extrusion Plant (CH/MT/102)' : 'VPC Plant (LS/MT/102)',
        st.code,
        st.name,
        '[AUDIT VERIFICATION]',
        'Technician Sign-off (EPF)',
        'Inspector EPF Identity',
      ];

      for (let d = 1; d <= 31; d++) {
        const sub = inspections.find((s) => s.stationId === st.id && s.day === d);
        techRow.push(sub?.epf ? sub.epf : '-');
      }
      rows.push(techRow);
    }

    const wsMatrix = XLSX.utils.aoa_to_sheet(rows);
    wsMatrix['!cols'] = [
      { wch: 30 }, // Plant
      { wch: 14 }, // Code
      { wch: 32 }, // Name
      { wch: 26 }, // Equipment
      { wch: 30 }, // Item
      { wch: 45 }, // Standard
      ...Array.from({ length: 31 }, () => ({ wch: 12 })),
    ];

    // ==========================================
    // 2. SHEET 2: Technician Audit Trail & Submission Log
    // ==========================================
    const auditHeaders = [
      'Submission Date',
      'Day',
      'Plant',
      'Station Code',
      'Station Name',
      'Technician EPF',
      'Technician Name',
      'Submission Timestamp',
      'Total Checks',
      'OK Count',
      'Defects Count',
      'Standby Count',
      'Defect Notes & Observations',
    ];

    const auditRows: any[][] = [auditHeaders];

    for (const ins of inspections) {
      const okCount = ins.items.filter((i) => i.status === 'OK' || i.status === '√').length;
      const defectCount = ins.items.filter((i) => i.status === 'DEFECT' || i.status === 'X').length;
      const standbyCount = ins.items.filter((i) => i.status === 'STANDBY' || i.status === '0').length;
      const defectNotes = ins.items
        .filter((i) => i.defectNote && i.defectNote.trim().length > 0)
        .map((i) => `${i.checkpoint?.itemName || 'Item'}: ${i.defectNote}`)
        .join('; ');

      const submissionDateFormatted = new Date(Number(ins.submittedAt)).toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });

      auditRows.push([
        ins.inspectionDate,
        ins.day,
        ins.station?.plant || '',
        ins.station?.code || '',
        ins.station?.name || '',
        ins.epf,
        ins.user?.name || `Technician (${ins.epf})`,
        submissionDateFormatted,
        ins.items.length,
        okCount,
        defectCount,
        standbyCount,
        defectNotes || 'None (Normal Inspection)',
      ]);
    }

    const wsAudit = XLSX.utils.aoa_to_sheet(auditRows);
    wsAudit['!cols'] = [
      { wch: 16 }, // Date
      { wch: 6 },  // Day
      { wch: 16 }, // Plant
      { wch: 14 }, // Code
      { wch: 32 }, // Station
      { wch: 18 }, // EPF
      { wch: 25 }, // Name
      { wch: 22 }, // Timestamp
      { wch: 14 }, // Total
      { wch: 12 }, // OK
      { wch: 14 }, // Defects
      { wch: 14 }, // Standby
      { wch: 50 }, // Notes
    ];

    // ==========================================
    // 3. SHEET 3: Defect Register (Flagged Checkpoints)
    // ==========================================
    const defectHeaders = [
      'Inspection Date',
      'Plant',
      'Station Code',
      'Station Name',
      'Equipment',
      'Checkpoint Item',
      'Standard Criteria',
      'Defect Observation Note',
      'Reported By Technician (EPF)',
      'Technician Name',
    ];

    const defectRows: any[][] = [defectHeaders];

    for (const ins of inspections) {
      for (const it of ins.items) {
        if (it.status === 'DEFECT' || it.status === 'X' || (it.defectNote && it.defectNote.trim().length > 0)) {
          defectRows.push([
            ins.inspectionDate,
            ins.station?.plant || '',
            ins.station?.code || '',
            ins.station?.name || '',
            it.checkpoint?.equipmentName || '',
            it.checkpoint?.itemName || '',
            it.checkpoint?.lookForCriteria || '',
            it.defectNote || 'Defect flagged without additional note',
            ins.epf,
            ins.user?.name || `Technician (${ins.epf})`,
          ]);
        }
      }
    }

    const wsDefects = XLSX.utils.aoa_to_sheet(defectRows);
    wsDefects['!cols'] = [
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 32 },
      { wch: 25 },
      { wch: 28 },
      { wch: 45 },
      { wch: 45 },
      { wch: 26 },
      { wch: 25 },
    ];

    // Build multi-sheet workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMatrix, `Monthly Grid (${month})`);
    XLSX.utils.book_append_sheet(wb, wsAudit, 'Technician Audit Trail');
    XLSX.utils.book_append_sheet(wb, wsDefects, 'Defect Register');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Alumex_Maintenance_Report_${month}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

