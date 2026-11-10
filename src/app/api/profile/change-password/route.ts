import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epf, currentPassword, newPassword } = body;

    if (!epf || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'EPF / username, current password, and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 4 characters long' },
        { status: 400 }
      );
    }

    const rawEpf = (epf || '').trim();
    const isAdmin = rawEpf.toLowerCase() === 'admin';
    const targetEpf = isAdmin ? 'admin' : rawEpf.toUpperCase();

    // Find user (Technician or Admin)
    let user = await db.user.findFirst({
      where: isAdmin
        ? { OR: [{ epf: 'admin' }, { epf: 'ADMIN' }, { role: 'SUPERVISOR' }] }
        : { epf: targetEpf },
    });

    // If user record does not exist in DB yet, verify initial default password
    if (!user) {
      const defaultPass = isAdmin ? 'admin123' : 'tech123';
      const isDefaultMatch =
        currentPassword === defaultPass || (isAdmin && currentPassword === 'admin');

      if (isDefaultMatch) {
        user = await db.user.create({
          data: {
            epf: targetEpf,
            name: isAdmin ? 'Plant Supervisor / Admin' : `Technician (${targetEpf})`,
            password: newPassword,
            role: isAdmin ? 'SUPERVISOR' : 'TECHNICIAN',
          },
        });
        return NextResponse.json({
          success: true,
          message: `${isAdmin ? 'Admin' : 'Technician'} password set successfully!`,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `Incorrect current password. Default initial password is "${defaultPass}".`,
          },
          { status: 401 }
        );
      }
    }

    // Verify current password against DB
    if (user.password !== currentPassword && !(isAdmin && user.password === 'admin123' && currentPassword === 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Update password in DB
    await db.user.update({
      where: { id: user.id },
      data: { password: newPassword },
    });

    return NextResponse.json({
      success: true,
      message: `${isAdmin ? 'Admin' : 'Technician'} password updated successfully! Use your new password on your next login.`,
    });
  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

