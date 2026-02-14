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

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute, joinRoute])

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
      <RouterProvider router={router} />
    </StrictMode>
  )
  root.render(app)
}
