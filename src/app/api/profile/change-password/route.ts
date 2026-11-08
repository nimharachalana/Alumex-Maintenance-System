import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epf, currentPassword, newPassword } = body;

    if (!epf || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'EPF, current password, and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 4 characters long' },
        { status: 400 }
      );
    }

    // Find technician user
    let user = await db.user.findUnique({
      where: { epf: epf.trim().toUpperCase() },
    });

    // If user does not exist yet in DB, create user with default or current password
    if (!user) {
      if (currentPassword === 'tech123') {
        user = await db.user.create({
          data: {
            epf: epf.trim().toUpperCase(),
            name: `Technician (${epf.trim().toUpperCase()})`,
            password: newPassword,
            role: 'TECHNICIAN',
          },
        });
        return NextResponse.json({
          success: true,
          message: 'Password created successfully for your EPF profile!',
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Incorrect current password. Default password is "tech123".' },
          { status: 401 }
        );
      }
    }

    // Verify current password
    if (user.password !== currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Update password
    await db.user.update({
      where: { epf: user.epf },
      data: { password: newPassword },
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully! Use your new password on your next login.',
    });
  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

