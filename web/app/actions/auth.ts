'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isDemoSession } from '@/lib/demoServer'
import { DEMO_COOKIE } from '@/lib/demo'

/**
 * ออกจากระบบ
 *
 * ทำที่ฝั่งเซิร์ฟเวอร์เพราะ session อยู่ใน cookie ที่ `proxy.ts` ต่ออายุให้ทุก
 * request — ล้างฝั่งเบราว์เซอร์อย่างเดียวจะเหลือ cookie ที่ยังใช้ได้ค้างอยู่
 *
 * `signOut()` ต้องยิงไป Supabase จริงเพื่อเพิกถอน refresh token · นี่เป็น
 * ข้อยกเว้นของกฎ "อย่ายิงเน็ตใน server action" โดยตั้งใจ เพราะการออกจากระบบ
 * ที่ไม่ได้เพิกถอน token คือการออกจากระบบที่ไม่ได้ออกจริง
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  // ⚠️ บัญชีตัวอย่างใช้ร่วมกัน — ค่าตั้งต้น `global` เพิกถอน session **ของทุกคน**
  //    ที่อยู่ใน demo พร้อมกัน · ออกแค่เครื่องนี้ (lib/demo.ts)
  const demo = await isDemoSession(supabase)
  await supabase.auth.signOut(demo ? { scope: 'local' } : undefined)
  ;(await cookies()).delete(DEMO_COOKIE)
  redirect('/login')
}
