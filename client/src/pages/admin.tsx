import * as React from 'react'
import { useAdminStore } from '../stores/admin-store'
import { useListRooms, useCreateRoom, useGetRoom } from '../netcode/rooms'
import { Input } from '@base-ui/react'
import './Admin.css'

export default function AdminPage() {
  const { token, setToken } = useAdminStore()
  const [roomCodeToFetch, setRoomCodeToFetch] = React.useState('')

  // Queries & Mutations
  const {
    data: rooms,
    error: listError,
    isLoading: isListLoading,
    refetch: refetchRooms,
  } = useListRooms()

  const {
    mutate: createRoom,
    isPending: isCreatePending,
    data: createdRoom,
    error: createError,
  } = useCreateRoom()

  const {
    mutate: getRoom,
    isPending: isGetPending,
    data: fetchedRoom,
    error: getError,
  } = useGetRoom()

  const handleCreateRoom = () => {
    createRoom()
  }

  const handleGetRoom = () => {
    if (roomCodeToFetch) {
      getRoom(roomCodeToFetch)
    }
  }

  return (
    <div className='admin-container'>
      <header className='admin-header'>
        <h1 className='admin-title'>Admin & Debugging Console</h1>
      </header>

      {/* Token Section */}
      <section className='token-section'>
        <label htmlFor='token-input' style={{ whiteSpace: 'nowrap' }}>AUTH TOKEN:</label>
        <Input
          id='token-input'
          className='admin-input'
          value={token ?? ''}
          onChange={(event) => {
            setToken(event.target.value)
          }}
          placeholder='Enter secret passphrase...'
          type='password'
        />
      </section>

      <div className='endpoints-grid'>

        {/* CREATE ROOM Section */}
        <div className='endpoint-card'>
          <div className='endpoint-title'>
            <span>Create Room</span>
            <span className='endpoint-method'>POST</span>
          </div>
          <div>
            <p className='endpoint-desc'>Generate a new game room.</p>
            <button
              className='admin-btn'
              onClick={handleCreateRoom}
              disabled={isCreatePending || !token}
            >
              {isCreatePending ? 'Creating...' : 'Execute /rooms/create'}
            </button>
          </div>

          {(createdRoom ?? createError) && (
            <div className={`response-area ${createError ? 'status-error' : 'status-success'}`}>
              {createError
                ? (
                    `Error: ${createError.message}`
                  )
                : (
                    JSON.stringify(createdRoom, undefined, 2)
                  )}
            </div>
          )}
        </div>

        {/* LIST ROOMS Section */}
        <div className='endpoint-card' style={{ gridRow: 'span 2' }}>
          <div className='endpoint-title'>
            <span>List Rooms</span>
            <span className='endpoint-method'>GET</span>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p className='endpoint-desc'>Fetch all active rooms.</p>
              <button
                className='admin-btn'
                onClick={() => {
                  refetchRooms().catch((error: unknown) => {
                    console.error(error)
                  })
                }}
                disabled={isListLoading || !token}
              >
                Refresh
              </button>
            </div>

            {listError && (
              <div className='response-area status-error'>
                Error:
                {' '}
                {listError.message}
              </div>
            )}

            <div className='room-list response-area'>
              {isListLoading
                ? (
                    <div>Loading...</div>
                  )
                : (rooms && rooms.length > 0
                    ? (
                        rooms.map(room => (
                          <div key={room.room_id} className='room-item'>
                            <span>{room.room_code}</span>
                            <span style={{ opacity: 0.5 }}>{room.room_state ?? 'WAITING'}</span>
                          </div>
                        ))
                      )
                    : (
                        <div style={{ padding: '1rem', opacity: 0.5 }}>No rooms found</div>
                      ))}
            </div>
          </div>
        </div>

        {/* GET ROOM Section */}
        <div className='endpoint-card'>
          <div className='endpoint-title'>
            <span>Get Room Details</span>
            <span className='endpoint-method'>GET</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Input
              className='admin-input'
              placeholder='Room Code (e.g. ABCDE)'
              value={roomCodeToFetch}
              onChange={(event) => {
                setRoomCodeToFetch(event.target.value.toUpperCase())
              }}
            />
            <button
              className='admin-btn'
              onClick={handleGetRoom}
              disabled={isGetPending || !token || !roomCodeToFetch}
            >
              Fetch
            </button>
          </div>

          {(fetchedRoom ?? getError) && (
            <div className={`response-area ${getError ? 'status-error' : 'status-success'}`}>
              {getError
                ? (
                    `Error: ${getError.message}`
                  )
                : (
                    JSON.stringify(fetchedRoom, undefined, 2)
                  )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
