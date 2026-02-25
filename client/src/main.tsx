import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Landing from './pages/landing'
import Join from './pages/join'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminPage from './pages/admin'
import TeamSetup from './pages/team-setup'
import WaitingRoom from './pages/waiting'
import { GameLayout } from './pages/game-layout'
import GameRoute1 from './pages/game/route-1'
import GameRoute2 from './pages/game/route-2'

const queryClient = new QueryClient()

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

function About() {
  return <div className='p-2'>Hello from About!</div>
}

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: About,
})

const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/join',
  component: Join,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
})

const teamChooseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/team-setup',
  component: TeamSetup,
})

const waitingRoomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/waiting-room',
  component: WaitingRoom,
})

const gameLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/game',
  component: GameLayout,
})

const gameRoute1 = createRoute({
  getParentRoute: () => gameLayoutRoute,
  path: '/1',
  component: GameRoute1,
})

const gameRoute2 = createRoute({
  getParentRoute: () => gameLayoutRoute,
  path: '/2',
  component: GameRoute2,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  joinRoute,
  adminRoute,
  teamChooseRoute,
  waitingRoomRoute,
  gameLayoutRoute.addChildren([gameRoute1, gameRoute2]),
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

const rootElement = document.querySelector('#root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  const app = (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
  root.render(app)
}
