'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEMO_COOKIE, DEVICE_COOKIE } from '@/lib/demo'

export type DemoResult = { ok: true } | { ok: false; error: string }

/**
 * เข้าบัญชีตัวอย่าง: ล็อกอิน → ล้างแล้วใส่ข้อมูลตัวอย่างใหม่ → ติด cookie
 *
 * ทำฝั่งเซิร์ฟเวอร์เพราะ**รหัสผ่านของบัญชี demo ต้องไม่ลงเบราว์เซอร์** — อยู่ใน
 * env `DEMO_EMAIL` / `DEMO_PASSWORD` เท่านั้น (ห้ามมี `NEXT_PUBLIC_` นำหน้า)
 * · ต่อให้รหัสหลุด ก็เปลี่ยนรหัสหรืออีเมลไม่ได้ (trigger `lock_demo_credentials`)
 *
 * ⚠️ `signInWithPassword` เป็น network call ใน server action โดยตั้งใจ — แบบเดียว
 *    กับ `signOut()` · การล็อกอินไม่มีทางทำได้จาก JWT ที่ยังไม่มี
 */
export async function enterDemo(): Promise<DemoResult> {
  const email = process.env.DEMO_EMAIL?.trim()
  // trim: ค่าที่ใส่ผ่าน `vercel env add` ทาง stdin อาจติดขึ้นบรรทัดใหม่มา และค่าแบบ
  // Sensitive อ่านกลับมาตรวจไม่ได้ · รหัสที่สคริปต์สุ่ม (base64url) ไม่มีช่องว่างอยู่แล้ว
  const password = process.env.DEMO_PASSWORD?.trim()
  if (!email || !password) return { ok: false, error: 'ยังไม่ได้เปิดบัญชีตัวอย่าง' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: 'เข้าบัญชีตัวอย่างไม่สำเร็จ · ลองใหม่อีกครั้ง' }

  // หลัง signIn client ตัวเดียวกันถือ session ใหม่แล้ว · rpc นี้จึงวิ่งในนามบัญชี demo
  const { error: resetError } = await supabase.rpc('reset_demo')
  if (resetError) {
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: false, error: 'เตรียมข้อมูลตัวอย่างไม่สำเร็จ · ลองใหม่อีกครั้ง' }
  }

  const jar = await cookies()
  const secure = process.env.NODE_ENV === 'production'
  // ไม่มี maxAge = หมดตอนปิดเบราว์เซอร์ · ตัวที่ทำให้ "เปิดใหม่ = หลุด" จริงคือ
  // ธงใน sessionStorage (components/DemoGuard.tsx) cookie นี้แค่บอกว่าต้องตรวจ
  jar.set(DEMO_COOKIE, '1', { path: '/', sameSite: 'lax', secure })
  if (!jar.get(DEVICE_COOKIE)) {
    jar.set(DEVICE_COOKIE, crypto.randomUUID(), {
      path: '/', sameSite: 'lax', secure, httpOnly: true, maxAge: 60 * 60 * 24 * 365,
    })
  }

  return { ok: true }
}
