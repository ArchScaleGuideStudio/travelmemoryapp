import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@components/shared/ProtectedRoute'

import Dashboard from '@pages/Dashboard'
import MapView from '@pages/MapView'
import Timeline from '@pages/Timeline'
import PlaceDetail from '@pages/PlaceDetail'
import AddPlace from '@pages/AddPlace'
import TripDetail from '@pages/TripDetail'
import Gallery from '@pages/Gallery'
import Albums from '@pages/Albums'
import AlbumDetail from '@pages/AlbumDetail'
import Search from '@pages/Search'
import Settings from '@pages/Settings'
import RecentlyDeleted from '@pages/RecentlyDeleted'
import PublicReviewsList from '@pages/PublicReviewsList'
import PublicReviewEditor from '@pages/PublicReviewEditor'
import PublicReviewShare from '@pages/PublicReviewShare'
import Login from '@pages/auth/Login'
import Signup from '@pages/auth/Signup'
import NotFound from '@pages/NotFound'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth/login"  element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />
      <Route path="/r/:slug"     element={<PublicReviewShare />} />

      {/* Protected — Core */}
      <Route path="/"                  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/map"               element={<ProtectedRoute><MapView /></ProtectedRoute>} />
      <Route path="/timeline"          element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
      <Route path="/gallery"           element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
      <Route path="/search"            element={<ProtectedRoute><Search /></ProtectedRoute>} />

      {/* Places */}
      <Route path="/places/new"        element={<ProtectedRoute><AddPlace /></ProtectedRoute>} />
      <Route path="/places/:id"        element={<ProtectedRoute><PlaceDetail /></ProtectedRoute>} />

      {/* Trips */}
      <Route path="/trips/:id"         element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />

      {/* Albums */}
      <Route path="/albums"            element={<ProtectedRoute><Albums /></ProtectedRoute>} />
      <Route path="/albums/:id"        element={<ProtectedRoute><AlbumDetail /></ProtectedRoute>} />

      {/* Public reviews */}
      <Route path="/public-reviews"      element={<ProtectedRoute><PublicReviewsList /></ProtectedRoute>} />
      <Route path="/public-reviews/new"  element={<ProtectedRoute><PublicReviewEditor /></ProtectedRoute>} />
      <Route path="/public-reviews/:id"  element={<ProtectedRoute><PublicReviewEditor /></ProtectedRoute>} />

      {/* Account & safety */}
      <Route path="/recently-deleted"  element={<ProtectedRoute><RecentlyDeleted /></ProtectedRoute>} />
      <Route path="/settings"          element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="/404" element={<NotFound />} />
      <Route path="*"    element={<Navigate to="/404" replace />} />
    </Routes>
  )
}
