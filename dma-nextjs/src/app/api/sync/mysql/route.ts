import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import path from 'path'
import util from 'util'

const execFileAsync = util.promisify(execFile)

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync-from-mysql.js')
    const { stdout, stderr } = await execFileAsync('node', [scriptPath], {
      cwd: process.cwd(),
      timeout: 60000,
    })

    return NextResponse.json({
      status: 'success',
      message: 'MySQL to PostgreSQL sync completed successfully',
      output: stdout,
      warnings: stderr || undefined,
    })
  } catch (error: any) {
    console.error('[POST /api/sync/mysql] Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to sync from MySQL',
        details: error?.message,
      },
      { status: 500 }
    )
  }
}

