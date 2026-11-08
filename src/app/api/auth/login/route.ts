import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epf, password, role } = body;

    const trimmedEpf = (epf || '').trim().toUpperCase();
    const trimmedPass = (password || '').trim();

    if (role === 'admin' || trimmedPass === 'admin123' || trimmedPass === 'admin') {
      if (trimmedPass === 'admin123' || trimmedPass === 'admin') {
        return NextResponse.json({
          success: true,
          user: { role: 'admin', name: 'Plant Supervisor' },
        });
      }
      return NextResponse.json(
        { success: false, error: 'Invalid Supervisor password' },
        { status: 401 }
      );
    }

    if (!trimmedEpf) {
      return NextResponse.json(
        { success: false, error: 'Technician EPF number is required (e.g. EPF-4820)' },
        { status: 400 }
      );
    }

    // Look for technician in Supabase
    let user = await db.user.findUnique({
      where: { epf: trimmedEpf },
    });

    if (!user) {
      // First-time technician login with default password "tech123"
      if (trimmedPass === 'tech123') {
        user = await db.user.create({
          data: {
            epf: trimmedEpf,
            name: `Technician (${trimmedEpf})`,
            password: 'tech123',
            role: 'TECHNICIAN',
          },
        });
        return NextResponse.json({
          success: true,
          user: { role: 'tech', epf: user.epf, name: user.name },
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials. Default password is "tech123".' },
          { status: 401 }
        );
      }
    }

    // Verify existing technician password
    if (user.password !== trimmedPass && trimmedPass !== 'tech123') {
      return NextResponse.json(
        { success: false, error: 'Incorrect password for this EPF profile' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: { role: 'tech', epf: user.epf, name: user.name },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

