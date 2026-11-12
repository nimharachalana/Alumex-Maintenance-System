import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ALLOWED_EPFS = [
  'EPF-3520',
  'EPF-3526',
  'EPF-2545',
  'EPF-2253',
  'EPF-2712',
  'EPF-3457',
  'EPF-3174',
  'EPF-4040',
  'EPF-2298'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epf, password, role } = body;

    const trimmedEpf = (epf || '').trim();
    const trimmedPass = (password || '').trim();

    // 1. ADMIN / SUPERVISOR AUTHENTICATION
    if (role === 'admin' || trimmedEpf.toLowerCase() === 'admin') {
      let adminUser = await db.user.findFirst({
        where: {
          OR: [{ epf: 'admin' }, { epf: 'ADMIN' }, { role: 'SUPERVISOR' }],
        },
      });

      if (!adminUser) {
        // If admin record not in DB yet, check default password 'admin123' or 'admin'
        if (trimmedPass === 'admin123' || trimmedPass === 'admin') {
          adminUser = await db.user.create({
            data: {
              epf: 'admin',
              name: 'Admin',
              password: 'admin123',
              role: 'SUPERVISOR',
            },
          });
          return NextResponse.json({
            success: true,
            user: { role: 'admin', epf: 'admin', name: adminUser.name },
          });
        }
        return NextResponse.json(
          { success: false, error: 'Invalid Supervisor password' },
          { status: 401 }
        );
      }

      // Dynamic check against stored DB password
      if (adminUser.password !== trimmedPass && !(adminUser.password === 'admin123' && trimmedPass === 'admin')) {
        return NextResponse.json(
          { success: false, error: 'Incorrect Supervisor password' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        user: { role: 'admin', epf: 'admin', name: adminUser.name || 'Plant Supervisor' },
      });
    }

    // 2. TECHNICIAN AUTHENTICATION (WHITELIST ENFORCEMENT)
    const formattedEpf = trimmedEpf.toUpperCase();
    if (!formattedEpf) {
      return NextResponse.json(
        { success: false, error: 'Technician EPF number is required (e.g. EPF-3520)' },
        { status: 400 }
      );
    }

    if (!ALLOWED_EPFS.includes(formattedEpf)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unauthorized: EPF '${formattedEpf}' is not registered in the system. Contact your supervisor.`,
        },
        { status: 403 }
      );
    }

    // Look for technician in DB
    let user = await db.user.findUnique({
      where: { epf: formattedEpf },
    });

    if (!user) {
      // First-time technician login for whitelisted EPF with default password 'tech123'
      if (trimmedPass === 'tech123') {
        user = await db.user.create({
          data: {
            epf: formattedEpf,
            name: `Technician (${formattedEpf})`,
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
          { success: false, error: 'Invalid credentials. Default initial password is "tech123".' },
          { status: 401 }
        );
      }
    }

    // All technicians use the same fixed password.
    if (trimmedPass !== 'tech123') {
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

