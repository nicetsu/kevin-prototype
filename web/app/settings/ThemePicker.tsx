'use client'

import { useSyncExternalStore } from 'react'
import { readThemePref, setThemePref, type ThemePref } from '@/lib/theme'

/**
 * เลือกธีม อัตโนมัติ / สว่าง / มืด · จำต่อเครื่อง (lib/theme.ts)
 *
 * อ่านค่าผ่าน useSyncExternalStore แทน useState — ฝั่งเซิร์ฟเวอร์ไม่มี localStorage
 * จึงวาด "อัตโนมัติ" ไปก่อน แล้วค่อยเป็นค่าจริงหลัง hydrate โดยไม่ต้อง setState ใน effect
 */
const CHANGED = 'kevin-theme-change'

function subscribe(cb: () => void) {
  window.addEventListener(CHANGED, cb)
  return () => window.removeEventListener(CHANGED, cb)
}

const OPTIONS: { id: ThemePref; label: string }[] = [
  { id: 'auto', label: 'อัตโนมัติ' },
  { id: 'light', label: 'สว่าง' },
  { id: 'dark', label: 'มืด' },
]

export default function ThemePicker() {
  const pref = useSyncExternalStore(subscribe, readThemePref, () => 'auto' as ThemePref)

  function choose(next: ThemePref) {
    setThemePref(next)
    window.dispatchEvent(new Event(CHANGED))
  }

  return (
    <>
      <div className="seg seg--wide" role="group" aria-label="ธีม">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" data-on={pref === o.id} aria-pressed={pref === o.id}
            onClick={() => choose(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      <span className="hint">อัตโนมัติ = สว่างหรือมืดตามโหมดของเครื่อง · จำไว้เฉพาะเครื่องนี้</span>
    </>
  )
}
