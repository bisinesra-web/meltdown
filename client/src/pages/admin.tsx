import {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAdminStore } from '../stores/admin-store'
import {
  useListRooms, useCreateRoom, useGetRoom, useDeleteRoom, type Room,
} from '../netcode/rooms'
import { Input } from '@base-ui/react'
import HexScramble from '../components/hex-scramble'
import './admin.css'

type SortField = 'room_code' | 'player_1_name' | 'player_2_name' | 'room_state' | 'created_at'
type SortOrder = 'asc' | 'desc' | undefined

interface BatchDeleteState {
  total: number
  completed: number
  failed: number
  inProgress: boolean
}

export default function AdminPage() {
  const { token, setToken } = useAdminStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set())
  const [expandedRoom, setExpandedRoom] = useState<string | undefined>()
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [batchDeleteState, setBatchDeleteState] = useState<BatchDeleteState | undefined>()
  const [tokenInputVisible, setTokenInputVisible] = useState(false)
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [player1Name, setPlayer1Name] = useState('Operator')
  const [player2Name, setPlayer2Name] = useState('Saboteur')
  const deleteTimeoutsReference = useRef<ReturnType<typeof setTimeout>[]>([])

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
    data: fetchedRoom,
  } = useGetRoom()

  const {
    mutate: deleteRoom,
    isPending: isDeletePending,
  } = useDeleteRoom()

  // Filter and sort rooms
  const filteredAndSortedRooms = useMemo(() => {
    if (!rooms) {
      return []
    }

    const filtered = rooms.filter((room) => {
      const query = searchQuery.toLowerCase()
      return (
        room.room_code.toLowerCase().includes(query)
        || room.player_1_name.toLowerCase().includes(query)
        || room.player_2_name.toLowerCase().includes(query)
        || (room.room_state?.toLowerCase().includes(query) ?? false)
      )
    })

    if (sortOrder && sortField) {
      filtered.sort((a, b) => {
        let aValue: unknown = a[sortField]
        let bValue: unknown = b[sortField]

        if (sortField === 'created_at') {
          aValue = new Date(aValue as string).getTime()
          bValue = new Date(bValue as string).getTime()
        }

        if (aValue === bValue) {
          return 0
        }
        const isLess = (aValue as number) < (bValue as number)
        return sortOrder === 'asc' ? (isLess ? -1 : 1) : (isLess ? 1 : -1)
      })
    }

    return filtered
  }, [rooms, searchQuery, sortField, sortOrder])

  const getRoomState = useCallback((room: Room) => {
    if (!room.room_state) {
      return 'idle'
    }
    try {
      const state = JSON.parse(room.room_state) as {
        phase?: string
      }
      if (state.phase?.includes('completed')) {
        return 'completed'
      }
      if (state.phase?.includes('waiting')) {
        return 'waiting'
      }
      if (state.phase) {
        return 'active'
      }
    } catch {
      // ignore parse errors
    }

    return 'idle'
  }, [])

  const getStateColor = useCallback(
    (roomState: 'active' | 'waiting' | 'completed' | 'idle') => {
      switch (roomState) {
        case 'active': {
          return 'active'
        }
        case 'waiting': {
          return 'waiting'
        }
        case 'completed': {
          return 'idle'
        }
        default: {
          return 'idle'
        }
      }
    },
    [],
  )

  const highlightSearchMatch = useCallback((text: string) => {
    if (!searchQuery) {
      return text
    }
    const regex = new RegExp(
      String.raw`(${searchQuery.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'giu',
    )
    const parts = text.split(regex)
    return parts
      .map(part => (regex.test(part) ? `<mark>${part}</mark>` : part))
      .join('')
  }, [searchQuery])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else if (sortOrder === 'desc') {
        setSortOrder(undefined)
      } else {
        setSortOrder('asc')
      }
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleSelectRoom = (code: string, checked: boolean) => {
    const newSelected = new Set(selectedRooms)
    if (checked) {
      newSelected.add(code)
    } else {
      newSelected.delete(code)
    }
    setSelectedRooms(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRooms(new Set(filteredAndSortedRooms.map(r => r.room_code)))
    } else {
      setSelectedRooms(new Set())
    }
  }

  const handleBatchDelete = useCallback(() => {
    const roomsToDelete = [...selectedRooms]
    setBatchDeleteState({
      total: roomsToDelete.length,
      completed: 0,
      failed: 0,
      inProgress: true,
    })

    let completed = 0
    let failed = 0

    roomsToDelete.forEach((code, index) => {
      const timeout = setTimeout(() => {
        deleteRoom(code, {
          onSuccess() {
            completed += 1
            setBatchDeleteState(
              previous => (previous ? { ...previous, completed } : undefined),
            )
            if (completed + failed === roomsToDelete.length) {
              refetchRooms().catch(console.error)
              setTimeout(() => {
                setBatchDeleteState(undefined)
                setSelectedRooms(new Set())
              }, 1000)
            }
          },
          onError() {
            failed += 1
            setBatchDeleteState(
              previous => (previous ? { ...previous, failed } : undefined),
            )
            if (completed + failed === roomsToDelete.length) {
              refetchRooms().catch(console.error)
              setTimeout(() => {
                setBatchDeleteState(undefined)
              }, 2000)
            }
          },
        })
      }, index * 200)

      deleteTimeoutsReference.current.push(timeout)
    })
  }, [selectedRooms, deleteRoom, refetchRooms])

  const handleCreateRoom = () => {
    createRoom({ player1: player1Name, player2: player2Name })
  }

  const handleShowRoomDetails = (room: Room) => {
    if (expandedRoom === room.room_code) {
      setExpandedRoom(undefined)
    } else {
      setExpandedRoom(room.room_code)
      getRoom(room.room_code)
    }
  }

  const handleDeleteRoom = (code: string) => {
    deleteRoom(code, {
      onSuccess() {
        setExpandedRoom(undefined)
        refetchRooms().catch(console.error)
      },
    })
  }

  useEffect(() => {
    const timeouts = deleteTimeoutsReference.current
    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout)
      }
    }
  }, [])

  return (
    <div className='admin-page'>
      <div className='admin-container'>
        {/* Header */}
        <header className='admin-header'>
          <h1 className='admin-title'>
            <HexScramble text='ADMIN CONSOLE' active={false} />
          </h1>
        </header>

        {/* Sidebar */}
        <aside className='admin-sidebar'>
          {/* Token Section */}
          <section className={`token-section ${!tokenInputVisible && token ? 'collapsed' : ''}`}>
            <div
              className="token-header"
              onClick={() => {
                if (token) setTokenInputVisible(!tokenInputVisible)
              }}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {token && <div className="token-status" />}
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {token ? 'AUTHENTICATED' : 'AUTH TOKEN'}
                </span>
              </div>
              {token && (
                <button
                  className="token-toggle"
                  onClick={e => {
                    e.stopPropagation()
                    setTokenInputVisible(!tokenInputVisible)
                  }}
                >
                  {tokenInputVisible ? '−' : '+'}
                </button>
              )}
            </div>
            {(tokenInputVisible || !token) && (
              <div className="token-input-wrapper">
                <Input
                  className="admin-input"
                  value={token ?? ''}
                  onChange={(event) => {
                    setToken(event.target.value)
                  }}
                  placeholder="Enter secret passphrase..."
                  type="password"
                />
              </div>
            )}
          </section>

          {/* Create Room Form */}
          <div className={`create-form ${!createFormOpen ? 'create-form-collapsed' : ''}`}>
            {!createFormOpen ? (
              <button
                className="admin-btn create-form-button"
                onClick={() => setCreateFormOpen(true)}
              >
                + New Room
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-accent)' }}>
                    CREATE ROOM
                  </span>
                  <button
                    className="token-toggle"
                    onClick={() => setCreateFormOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="create-form-inputs">
                  <label className="create-form-label">Player 1 Name</label>
                  <Input
                    className="admin-input"
                    placeholder="Operator"
                    value={player1Name}
                    onChange={(event) => {
                      setPlayer1Name(event.target.value)
                    }}
                  />
                  <label className="create-form-label">Player 2 Name</label>
                  <Input
                    className="admin-input"
                    placeholder="Saboteur"
                    value={player2Name}
                    onChange={(event) => {
                      setPlayer2Name(event.target.value)
                    }}
                  />
                </div>
                <button
                  className="admin-btn create-form-button"
                  onClick={handleCreateRoom}
                  disabled={isCreatePending || !token || !player1Name || !player2Name}
                >
                  {isCreatePending ? 'Creating...' : 'Execute'}
                </button>
                {createError && (
                  <div className="response-area status-error" style={{ marginTop: '0.75rem' }}>
                    {createError.message}
                  </div>
                )}
                {createdRoom && (
                  <div className="response-area status-success" style={{ marginTop: '0.75rem' }}>
                    Room created:
                    {' '}
                    {createdRoom.room_code}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-main">
          {/* Search Section */}
          <div className="search-section">
            <Input
              className="search-input"
              placeholder="Search by code, player name, or state..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          {/* Rooms Section */}
          <div className="rooms-section">
            <div className="rooms-controls">
              <span className="rooms-count">
                {filteredAndSortedRooms.length}
                {' '}
                room
                {filteredAndSortedRooms.length !== 1 ? 's' : ''}
              </span>
              {!isListLoading && (
                <button
                  className="room-action-btn"
                  onClick={() => refetchRooms().catch(console.error)}
                >
                  Refresh
                </button>
              )}
            </div>

            {listError && (
              <div className="response-area status-error">
                Error:
                {' '}
                {listError.message}
              </div>
            )}

            {isListLoading ? (
              <div className="response-area">Loading rooms...</div>
            ) : (
              <div className="rooms-table-wrapper">
                <table className="rooms-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          className="room-checkbox"
                          checked={selectedRooms.size === filteredAndSortedRooms.length && filteredAndSortedRooms.length > 0}
                          onChange={e => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th
                        className={`sortable ${sortField === 'room_code' ? `sort-${sortOrder}` : ''}`}
                        onClick={() => handleSort('room_code')}
                      >
                        Code
                      </th>
                      <th
                        className={`sortable ${sortField === 'player_1_name' ? `sort-${sortOrder}` : ''}`}
                        onClick={() => handleSort('player_1_name')}
                      >
                        Players
                      </th>
                      <th
                        className={`sortable ${sortField === 'room_state' ? `sort-${sortOrder}` : ''}`}
                        onClick={() => handleSort('room_state')}
                      >
                        State
                      </th>
                      <th
                        className={`sortable ${sortField === 'created_at' ? `sort-${sortOrder}` : ''}`}
                        onClick={() => handleSort('created_at')}
                      >
                        Created
                      </th>
                      <th style={{ width: '80px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredAndSortedRooms.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                            No rooms found
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedRooms.map(room => {
                          const roomState = getRoomState(room)
                          const isSelected = selectedRooms.has(room.room_code)

                          return (
                            <motion.tr
                              key={room.room_code}
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.2 }}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  className="room-checkbox"
                                  checked={isSelected}
                                  onChange={e => handleSelectRoom(room.room_code, e.target.checked)}
                                  onClick={e => e.stopPropagation()}
                                />
                              </td>
                              <td className="room-code">
                                <div
                                  onClick={() => handleShowRoomDetails(room)}
                                  dangerouslySetInnerHTML={{
                                    __html: highlightSearchMatch(room.room_code),
                                  }}
                                />
                              </td>
                              <td className="room-players">
                                <div style={{ fontSize: '0.85rem' }}>
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchMatch(room.player_1_name),
                                    }}
                                  />
                                  <div
                                    style={{ opacity: 0.7, fontSize: '0.8rem' }}
                                    dangerouslySetInnerHTML={{
                                      __html: highlightSearchMatch(room.player_2_name),
                                    }}
                                  />
                                </div>
                              </td>
                              <td>
                                <span className={`room-state-badge ${getStateColor(roomState as any)}`}>
                                  {roomState}
                                </span>
                              </td>
                              <td className="room-created">
                                {new Date(room.created_at).toLocaleString()}
                              </td>
                              <td className="room-actions">
                                <button
                                  className="room-action-btn"
                                  onClick={() => handleShowRoomDetails(room)}
                                >
                                  {expandedRoom === room.room_code ? 'Hide' : 'View'}
                                </button>
                              </td>
                            </motion.tr>
                          )
                        })
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}

            {/* Expanded Room Detail */}
            <AnimatePresence>
              {expandedRoom && fetchedRoom && (
                <motion.div
                  key={`detail-${expandedRoom}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="room-detail-row"
                >
                  <div className="room-detail-content">
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--admin-accent)' }}>
                        Room Details
                      </h3>
                      <div className="room-detail-json">
                        {JSON.stringify(fetchedRoom, null, 2)}
                      </div>
                    </div>
                    <div className="room-detail-actions">
                      <button
                        className="admin-btn delete-btn"
                        onClick={() => handleDeleteRoom(fetchedRoom.room_code)}
                        disabled={isDeletePending || !token}
                      >
                        {isDeletePending ? 'Deleting...' : 'Delete Room'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Batch Delete Action Bar */}
      <AnimatePresence>
        {selectedRooms.size > 0 && !batchDeleteState?.inProgress && (
          <motion.div
            key="batch-bar"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="batch-actions-bar"
          >
            <div className="batch-info">
              {selectedRooms.size}
              {' '}
              room
              {selectedRooms.size !== 1 ? 's' : ''}
              {' '}
              selected
            </div>
            <button
              className="batch-delete-btn"
              onClick={handleBatchDelete}
              disabled={isDeletePending || !token}
            >
              Delete Selected
            </button>
          </motion.div>
        )}
        {batchDeleteState?.inProgress && (
          <motion.div
            key="batch-progress"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="batch-actions-bar"
          >
            <div className="batch-info">
              Deleting rooms...
            </div>
            <div className="batch-progress">
              {batchDeleteState.completed}
              /
              {batchDeleteState.total}
              {batchDeleteState.failed > 0 && (
                <>
                  {' '}
                  (
                  {batchDeleteState.failed}
                  {' '}
                  failed)
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
