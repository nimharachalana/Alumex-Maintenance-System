import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LOCKOUT_DURATION_MS } from '@/lib/lockout';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    const whereClause: any = {};
    if (month) {
      whereClause.month = month;
    }

    const inspections = await db.inspection.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            checkpoint: true,
          },
        },
        station: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: inspections });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      stationId,
      epf,
      inspectionDate,
      day,
      month,
      shift,
      remarks,
      signatureUrl,
      records,
      isAdmin = false,
    } = body;

    if (!id || !stationId || !records || !Array.isArray(records)) {
      return NextResponse.json({ success: false, error: 'Missing required inspection fields' }, { status: 400 });
    }

    const now = Date.now();

    // Check existing record for 30-minute lockout rule
    const existing = await db.inspection.findUnique({
      where: { id },
    });

    let originalTime = now;
    if (existing) {
      originalTime = existing.submittedAt;
      const elapsed = now - existing.submittedAt;
      if (elapsed > LOCKOUT_DURATION_MS && !isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Compliance Rejected: 30 minutes have elapsed since original submission. Values are permanently locked.',
          },
          { status: 403 }
        );
      }
    }

    // Save or update inspection
    const saved = await db.inspection.upsert({
      where: { id },
      create: {
        id,
        stationId,
        epf: epf || 'EPF-TECH',
        inspectionDate: inspectionDate || new Date().toISOString().slice(0, 10),
        day: day || new Date().getDate(),
        month: month || new Date().toISOString().slice(0, 7),
        shift: shift || 'Shift 1',
        remarks: remarks || '',
        signatureUrl: signatureUrl || null,
        submittedAt: originalTime,
        lastModifiedAt: now,
      },
      update: {
        remarks: remarks || '',
        signatureUrl: signatureUrl || undefined,
        lastModifiedAt: now,
      },
    });

    // Delete existing item results for this inspection before re-inserting
    await db.inspectionItemResult.deleteMany({
      where: { inspectionId: id },
    });

    // Bulk insert items
    for (const r of records) {
      let checkpointId = r.checkpointId;
      if (!checkpointId) {
        // Find matching checkpoint by equipment and item
        const cp = await db.checkpoint.findFirst({
          where: {
            stationId,
            equipmentName: r.equipment,
            itemName: r.item,
          },
        });
        if (cp) checkpointId = cp.id;
      }

      if (checkpointId) {
        await db.inspectionItemResult.create({
          data: {
            inspectionId: id,
            checkpointId,
            status: r.status || '√',
            reading: r.reading || '',
          },
        });
      }
    }

    return NextResponse.json({ success: true, id: saved.id, submittedAt: originalTime });
  } catch (error: any) {
    console.error('Inspection save error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

