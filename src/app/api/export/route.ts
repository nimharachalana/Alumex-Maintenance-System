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
        items: true,
      },
    });

    // Build SheetJS Array of Arrays (AOA)
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
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Audit ${month}`);
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

