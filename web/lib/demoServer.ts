/** ตัวตรวจบัญชี demo ฝั่งเซิร์ฟเวอร์ · ภาพรวมอยู่หัว lib/demo.ts */
import { cookies } from 'next/headers'
import type { createClient } from '@/lib/supabase/server'
import { DEMO_LIMITS, DEVICE_COOKIE } from '@/lib/demo'

/** อีเมลของบัญชีที่ล็อกอินอยู่เป็นบัญชี demo ไหม · ตรวจ JWT ในเครื่อง ไม่ยิงเน็ต */
export async function isDemoSession(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const demo = process.env.DEMO_EMAIL?.trim().toLowerCase()
  if (!demo) return false
  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email
  return typeof email === 'string' && email.toLowerCase() === demo
}

/**
 * หักโควตาผู้ช่วยหนึ่งครั้งถ้าเป็นบัญชี demo · คืนข้อความปฏิเสธ หรือ null = ไปต่อได้
 *
 * บัญชีจริงคืน null ทันทีโดยไม่แตะ DB
 * ไม่มี cookie เครื่อง (ลบทิ้ง) → นับรวมเป็นถังเดียวกันหมด ไม่ได้สิทธิ์ใหม่ฟรี
 */
export async function takeDemoQuota(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: 'chat' | 'voice'
): Promise<string | null> {
  if (!(await isDemoSession(supabase))) return null

  const device = (await cookies()).get(DEVICE_COOKIE)?.value ?? 'no-device-cookie'
  const limit = DEMO_LIMITS[kind]
  const { data, error } = await supabase.rpc('demo_take', {
    p_device: device,
    p_kind: kind,
    p_per_device: limit.perDevice,
    p_global: limit.global,
  })

  if (error) return 'ตรวจโควตาบัญชีตัวอย่างไม่สำเร็จ · ลองใหม่อีกครั้ง'
  if (data === 'ok') return null

  const what = kind === 'chat' ? `พิมพ์คุยได้ ${limit.perDevice} ข้อความ` : `โทรได้ ${limit.perDevice} ครั้ง`
  if (data === 'device') return `บัญชีตัวอย่าง${what}ต่อวัน · ครบแล้วสำหรับวันนี้`
  return 'บัญชีตัวอย่างมีคนใช้ผู้ช่วยครบโควตาของวันนี้แล้ว · กลับมาลองพรุ่งนี้'
}
