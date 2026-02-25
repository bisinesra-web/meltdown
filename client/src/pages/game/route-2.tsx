import { useSocketStore } from '../../stores/socket-store'

export function GameRoute2() {
  const status = useSocketStore(s => s.status)

  console.log('[GameRoute2] Rendered, socket status:', status)

  return (
    <div
      style={{
        padding: '20px',
        border: '2px solid green',
        borderRadius: '8px',
      }}
    >
      <h1>Game Route 2</h1>
      <p>
        Socket Status:
        {status}
      </p>
    </div>
  )
}

export default GameRoute2
