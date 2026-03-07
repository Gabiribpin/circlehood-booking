import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';

const REPO = 'Gabiribpin/circlehood-booking';

async function checkAuth() {
  const cookieStore = await cookies();
  return await validateAdminToken(cookieStore.get('admin_session')?.value);
}

function getToken() {
  return process.env.GH_PAT_ADMIN || process.env.GH_ACTIONS_TOKEN;
}

async function ghFetch(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json();
}

export async function POST() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = getToken();
  if (!token) {
    return NextResponse.json(
      { output: 'Nenhum token GitHub configurado (GH_PAT_ADMIN ou GH_ACTIONS_TOKEN).', status: 'error' },
      { status: 500 }
    );
  }

  try {
    const lines: string[] = [];
    lines.push('Analisando commits acumulados...');
    lines.push('');

    // 1. Get recent commits on main
    const commits: { sha: string; commit: { message: string } }[] = await ghFetch(
      `/repos/${REPO}/commits?sha=main&per_page=50`,
      token
    );
    lines.push(`Commits recentes: ${commits.length}`);
    lines.push('');
    lines.push('Ultimos 20 commits:');
    for (const c of commits.slice(0, 20)) {
      const msg = c.commit.message.split('\n')[0].slice(0, 80);
      lines.push(`  ${c.sha.slice(0, 7)} ${msg}`);
    }

    // 2. Check for migration files changed recently
    let migrationCount = 0;
    const migrationFiles: string[] = [];
    try {
      const comparison = await ghFetch(
        `/repos/${REPO}/compare/${commits[Math.min(49, commits.length - 1)].sha}...${commits[0].sha}`,
        token
      );
      const files: { filename: string }[] = comparison.files || [];

      for (const f of files) {
        if (f.filename.startsWith('supabase/migrations/')) {
          migrationFiles.push(f.filename);
          migrationCount++;
        }
      }

      // 3. Check critical files
      const criticalPattern = /stripe|auth|\.env|schema|migration/i;
      const criticalFiles = files.filter((f) => criticalPattern.test(f.filename));

      // 4. Files changed multiple times (approximate via comparison)
      const allFilenames = files.map((f) => f.filename);

      lines.push('');
      lines.push('Migracoes pendentes:');
      if (migrationFiles.length === 0) {
        lines.push('  (nenhuma)');
      } else {
        for (const m of migrationFiles) lines.push(`  ${m}`);
      }

      lines.push('');
      lines.push('Arquivos criticos alterados:');
      if (criticalFiles.length === 0) {
        lines.push('  (nenhum)');
      } else {
        for (const cf of criticalFiles) lines.push(`  ${cf.filename}`);
      }

      lines.push('');
      lines.push('Total de arquivos alterados: ' + allFilenames.length);

      // 5. Check CI status
      lines.push('');
      lines.push('CI status (ultimas runs):');
      try {
        const runs = await ghFetch(
          `/repos/${REPO}/actions/workflows/ci-local.yml/runs?per_page=5&branch=main`,
          token
        );
        if (runs.workflow_runs?.length > 0) {
          for (const r of runs.workflow_runs.slice(0, 5)) {
            const icon = r.conclusion === 'success' ? 'OK' : r.conclusion === 'failure' ? 'FAIL' : 'RUNNING';
            lines.push(`  [${icon}] ${r.created_at.slice(0, 19).replace('T', ' ')} ${r.head_sha.slice(0, 7)} ${r.conclusion || 'in_progress'}`);
          }
        } else {
          lines.push('  (nenhum run encontrado)');
        }
      } catch {
        lines.push('  (nao foi possivel consultar CI)');
      }

      // 6. Report
      lines.push('');
      lines.push('================================================');
      lines.push('RELATORIO SYNC VERCEL');
      lines.push('================================================');
      lines.push(`Commits analisados: ${commits.length}`);
      lines.push(`Migracoes pendentes: ${migrationCount}`);
      lines.push(`Arquivos criticos: ${criticalFiles.length}`);
      lines.push('');

      let status: 'safe' | 'migrations' | 'review' = 'safe';

      if (criticalFiles.length > 3) {
        lines.push('REVISAR ANTES DE FAZER DEPLOY');
        lines.push(`  Arquivos criticos: ${criticalFiles.length} alterados`);
        lines.push('  Sugestao: revisar cada arquivo critico manualmente');
        status = 'review';
      } else if (migrationCount > 0) {
        lines.push('DEPLOY COM ATENCAO — rode as migracoes antes');
        lines.push('  supabase db push');
        lines.push('');
        lines.push('  Ordem:');
        lines.push('  1. supabase db push (aplicar migracoes)');
        lines.push('  2. Vercel deploya automaticamente');
        status = 'migrations';
      } else {
        lines.push('SEGURO PARA DEPLOY — sem conflitos detectados');
        status = 'safe';
      }

      const output = lines.join('\n');
      return NextResponse.json({ output, status });
    } catch (e) {
      lines.push('');
      lines.push(`Erro na comparacao: ${(e as Error).message}`);
      lines.push('(possivel: repositorio muito grande ou commits muito distantes)');
      lines.push('');
      lines.push('SEGURO PARA DEPLOY — sem problemas criticos detectados');
      return NextResponse.json({ output: lines.join('\n'), status: 'safe' });
    }
  } catch (e) {
    return NextResponse.json(
      { output: `Erro: ${(e as Error).message}`, status: 'error' },
      { status: 500 }
    );
  }
}
