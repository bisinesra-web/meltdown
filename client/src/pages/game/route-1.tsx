import { useSocketStore } from '../../stores/socket-store'

export function GameRoute1() {
  const status = useSocketStore(s => s.status)

  console.log('[GameRoute1] Rendered, socket status:', status)

  return (
    <div
      style={{
        padding: '20px',
        border: '2px solid blue',
        borderRadius: '8px',
      }}
    >
      <h1>Game Route 1</h1>
      <p>
        Socket Status:
        {status}
      </p>
    </div>
  )
}

export default GameRoute1
