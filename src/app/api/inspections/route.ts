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
        user: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Safely serialize BigInt to Number for JSON responses
    const serialized = inspections.map((ins) => ({
      ...ins,
      submittedAt: Number(ins.submittedAt),
      lastModifiedAt: Number(ins.lastModifiedAt),
    }));

    return NextResponse.json({ success: true, data: serialized });
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
      records,
    } = body;

    if (!id || !stationId || !records || !Array.isArray(records)) {
      return NextResponse.json({ success: false, error: 'Missing required inspection fields' }, { status: 400 });
    }

    const now = Date.now();

    // Check existing record for strict 30-minute lockout rule
    const existing = await db.inspection.findUnique({
      where: { id },
    });

    let originalTime = BigInt(now);
    if (existing) {
      originalTime = existing.submittedAt;
      const elapsed = now - Number(existing.submittedAt);
      if (elapsed > LOCKOUT_DURATION_MS) {
        return NextResponse.json(
          {
            success: false,
            error: 'Compliance Lockout: 30 minutes have elapsed since submission. Records are permanently locked and cannot be modified.',
          },
          { status: 403 }
        );
      }
    }

    const cleanEpf = (epf || 'EPF-TECH').trim().toUpperCase();
    const matchedUser = await db.user.findUnique({
      where: { epf: cleanEpf },
    });

    // Save or update inspection
    const saved = await db.inspection.upsert({
      where: { id },
      create: {
        id,
        stationId,
        userId: matchedUser?.id || null,
        epf: cleanEpf,
        inspectionDate: inspectionDate || new Date().toISOString().slice(0, 10),
        day: day || new Date().getDate(),
        month: month || new Date().toISOString().slice(0, 7),
        submittedAt: originalTime,
        lastModifiedAt: BigInt(now),
      },
      update: {
        epf: cleanEpf,
        userId: matchedUser?.id || undefined,
        lastModifiedAt: BigInt(now),
      },
    });

    // Delete existing item results for this inspection before re-inserting
    await db.inspectionItemResult.deleteMany({
      where: { inspectionId: id },
    });

    // Insert items with checkpoint defectNote
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
            status: r.status || 'OK',
            defectNote: r.defectNote || '',
          },
        });
      }
    }

    return NextResponse.json({ success: true, id: saved.id, submittedAt: Number(originalTime) });
  } catch (error: any) {
    console.error('Inspection save error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
