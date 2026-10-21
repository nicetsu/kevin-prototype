'use client'

/**
 * ยามของบัญชีตัวอย่าง — เจ้าของเคาะ "ปิดแอปแล้วเปิดใหม่ต้องเข้าใหม่" (21 ต.ค. 2026)
 *
 * เบราว์เซอร์ไม่บอกเราตอนถูกปัดทิ้ง (บนมือถือ `pagehide` ไม่ยิงบ่อยมาก) จึงตรวจ
 * กลับด้าน: ตอนเปิดหน้า ถ้า cookie บอกว่าอยู่ใน demo แต่ sessionStorage ของแท็บนี้
 * **ไม่มีธง** = นี่คือการเปิดใหม่ ไม่ใช่แท็บที่กดเข้า demo เอง → ออกจากระบบ
 * (sessionStorage ตายไปพร้อมแท็บ/แอป แต่รอดการรีเฟรช)
 *
 * แท็บที่ยังอยู่ใน demo ได้แถบบอกบนสุด — คนดูต้องรู้ตลอดว่าสิ่งที่พิมพ์ลงไป
 * คนอื่นเห็นได้และจะหายตอนมีคนกดเข้าครั้งถัดไป
 */

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { DEMO_COOKIE, DEMO_TAB_KEY } from '@/lib/demo'

type State = 'none' | 'demo' | 'kick'

/** อ่านใหม่ทุกครั้งที่ render (เช่นเปลี่ยนหน้า) · cookie ไม่มีเหตุการณ์ให้ subscribe */
function readState(): State {
  if (!document.cookie.split('; ').includes(`${DEMO_COOKIE}=1`)) return 'none'
  // อ่าน sessionStorage ไม่ได้ (โหมดส่วนตัวบางเบราว์เซอร์) → ปล่อยผ่าน
  // ไม่งั้นกดเข้า demo แล้วจะถูกเตะออกทันทีทุกครั้งแบบวนไม่จบ
  try { return sessionStorage.getItem(DEMO_TAB_KEY) === '1' ? 'demo' : 'kick' } catch { return 'demo' }
}

const noSubscribe = () => () => {}

export default function DemoGuard() {
  const pathname = usePathname()
  const state = useSyncExternalStore(noSubscribe, readState, () => 'none' as State)
  const active = pathname !== '/login'

  useEffect(() => {
    if (active && state === 'kick') void signOut()
  }, [active, state])

  if (!active || state !== 'demo') return null

  return (
    <div className="demo-bar" role="status">
      <span>บัญชีตัวอย่าง · คนอื่นเห็นสิ่งที่แก้ และจะรีเซ็ตเมื่อมีคนกดเข้าใหม่</span>
      <form action={signOut}>
        <button type="submit" className="demo-bar__out">ออก</button>
      </form>
    </div>
  )
}
