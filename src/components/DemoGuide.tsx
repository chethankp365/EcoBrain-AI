import { useState } from 'react'
import { Button } from './ui'

const STEPS = [
  'Resident reports an overflow with a photo and pin.',
  'AI classifies with confidence. Dispatcher confirms category.',
  'Dispatcher assigns, then plans a 2-vehicle shift.',
  'Solver compares optimised vs nearest-neighbour vs original.',
  'Dispatcher may drag-reorder, then approves the recommendation.',
  'Worker completes stops; one is marked inaccessible with a note.',
  'Dashboard and notifications update. Humans stay in the loop.',
  'Reset demo data from Admin when DEMO_MODE is true.',
]

export default function DemoGuide() {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  return (
    <>
      <button
        className="fixed bottom-20 right-4 z-40 min-h-[44px] rounded-full bg-white px-4 text-sm text-black md:bottom-6"
        onClick={() => setOpen(true)}
      >
        Guided demo
      </button>
      {open && (
        <div className="fixed bottom-24 right-4 z-40 w-80 glass p-5 md:bottom-16">
          <p className="text-xs text-white/40">Step {i + 1} / 8 · Section 18</p>
          <p className="mt-2 text-sm">{STEPS[i]}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="px-4 py-2" onClick={() => setI((x) => Math.max(0, x - 1))}>
              Back
            </Button>
            <Button className="px-4 py-2" onClick={() => (i === 7 ? setOpen(false) : setI((x) => x + 1))}>
              {i === 7 ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
