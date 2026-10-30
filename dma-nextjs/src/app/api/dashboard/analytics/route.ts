import { NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [requests, personnel, nations] = await Promise.all([
      prisma.dormRequest.findMany({
        orderBy: { id: 'desc' },
      }),
      prisma.dormPersonnel.findMany({
        orderBy: { id: 'desc' },
      }),
      prisma.nationSub.findMany(),
    ])

    const nationMap = new Map<string, string>()
    nations.forEach((n) => {
      const code = (n.code || '').toUpperCase()
      const info = (n.nation as any) || {}
      if (code) {
        nationMap.set(code, info.vi || info.en || code)
      }
    })

    const todayStr = new Date().toISOString().slice(0, 10)

    const totalRequests = requests.length
    const completedRequests = requests.filter(
      (r) => (r.status || '').toUpperCase() === 'COMPLETED'
    ).length
    const pendingRequests = requests.filter(
      (r) => (r.status || '').toUpperCase() === 'PENDING'
    ).length
    const declinedRequests = requests.filter(
      (r) => (r.status || '').toUpperCase() === 'DENIED'
    ).length

    const totalOccupants = personnel.length
    const assignedRoomsCount = personnel.filter(
      (p) => p.roomNo && p.roomNo.trim() !== ''
    ).length
    const unassignedRoomsCount = totalOccupants - assignedRoomsCount

    const vnOccupants = personnel.filter(
      (p) => (p.nationality || '').toUpperCase() === 'VNM'
    ).length
    const foreignOccupants = totalOccupants - vnOccupants

    const activeOccupants = personnel.filter((p) => {
      const start = p.startDate ? p.startDate.toISOString().slice(0, 10) : ''
      const end = p.endDate ? p.endDate.toISOString().slice(0, 10) : ''
      return (!start || start <= todayStr) && (!end || end >= todayStr)
    }).length

    // Breakdown by Nationality
    const byNationalityMap = new Map<string, number>()
    personnel.forEach((p) => {
      const code = (p.nationality || 'VNM').toUpperCase()
      byNationalityMap.set(code, (byNationalityMap.get(code) || 0) + 1)
    })
    const byNationality = Array.from(byNationalityMap.entries())
      .map(([code, count]) => ({
        code,
        name: nationMap.get(code) || code,
        count,
        percent:
          totalOccupants > 0 ? Math.round((count / totalOccupants) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Breakdown by Accom Status (Origin / Location)
    const byLocationMap = new Map<string, number>()
    personnel.forEach((p) => {
      const loc = (p.accomStatus || 'VG').trim() || 'VG'
      byLocationMap.set(loc, (byLocationMap.get(loc) || 0) + 1)
    })
    const byLocation = Array.from(byLocationMap.entries())
      .map(([loc, count]) => ({
        loc,
        count,
        percent:
          totalOccupants > 0 ? Math.round((count / totalOccupants) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Breakdown by Department
    const byDeptMap = new Map<string, number>()
    requests.forEach((r) => {
      const dept = (r.creatorDept || 'OTHER').trim() || 'OTHER'
      byDeptMap.set(dept, (byDeptMap.get(dept) || 0) + 1)
    })
    const byDepartment = Array.from(byDeptMap.entries())
      .map(([dept, count]) => ({
        dept,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Breakdown by Gender
    const maleCount = personnel.filter(
      (p) => (p.gender || 'Male').toLowerCase() === 'male'
    ).length
    const femaleCount = totalOccupants - maleCount

    // Top Assigned Rooms
    const byRoomMap = new Map<string, number>()
    personnel.forEach((p) => {
      const room = (p.roomNo || '').trim()
      if (room) {
        byRoomMap.set(room, (byRoomMap.get(room) || 0) + 1)
      }
    })
    const topRooms = Array.from(byRoomMap.entries())
      .map(([room, count]) => ({ room, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)

    // Monthly Trend (by key_in_date YYYY-MM)
    const byMonthMap = new Map<
      string,
      { month: string; requests: number; completed: number; pending: number; denied: number }
    >()
    requests.forEach((r) => {
      const d = r.keyInDate
        ? r.keyInDate.toISOString().slice(0, 7)
        : r.createdAt
          ? r.createdAt.toISOString().slice(0, 7)
          : 'Unknown'
      if (!byMonthMap.has(d)) {
        byMonthMap.set(d, {
          month: d,
          requests: 0,
          completed: 0,
          pending: 0,
          denied: 0,
        })
      }
      const item = byMonthMap.get(d)!
      item.requests++
      const st = (r.status || '').toUpperCase()
      if (st === 'COMPLETED') item.completed++
      else if (st === 'DENIED') item.denied++
      else item.pending++
    })
    const monthlyTrend = Array.from(byMonthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)

    return NextResponse.json(
      serializePrisma({
        kpis: {
          totalRequests,
          completedRequests,
          pendingRequests,
          declinedRequests,
          totalOccupants,
          activeOccupants,
          assignedRoomsCount,
          unassignedRoomsCount,
          vnOccupants,
          foreignOccupants,
          maleCount,
          femaleCount,
          uniqueRoomsUsed: byRoomMap.size,
        },
        byNationality,
        byLocation,
        byDepartment,
        topRooms,
        monthlyTrend,
      })
    )
  } catch (error: any) {
    console.error('[GET /api/dashboard/analytics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard analytics', details: error?.message },
      { status: 500 }
    )
  }
}
