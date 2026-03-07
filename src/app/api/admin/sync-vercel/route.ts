import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkAuth() {
  const cookieStore = await cookies();
  return await validateAdminToken(cookieStore.get('admin_session')?.value);
}

export async function POST() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execAsync(
      'bash sync-to-vercel.sh',
      { cwd: process.cwd(), timeout: 30000 }
    );
    const output = stdout || stderr;
    const needsReview = output.includes('REVISAR ANTES');
    const hasMigrations = output.includes('DEPLOY COM ATEN');

    return NextResponse.json({
      output,
      status: needsReview ? 'review' : hasMigrations ? 'migrations' : 'safe',
    });
  } catch (e) {
    return NextResponse.json(
      { output: String(e), status: 'error' },
      { status: 500 }
    );
  }
}
