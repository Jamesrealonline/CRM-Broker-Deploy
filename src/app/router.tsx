// ========================================================
// REAL ESTATE CRM - APPLICATION ROUTER
// Tuyến đường bảo vệ (AuthGuard, RoleGuard, PasswordChangeGuard)
// ========================================================

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { AuthGuard, RoleGuard } from './guards';

import { LoginPage } from '@/features/auth/LoginPage';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LeadsPage } from '@/features/leads/LeadsPage';
import { LeadDetailPage } from '@/features/leads/LeadDetailPage';
import { JourneyPage } from '@/features/journey/JourneyPage';
import { DistributionPage } from '@/features/distribution/DistributionPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProjectKnowledgePage } from '@/features/projects/ProjectKnowledgePage';
import { SalesScriptsPage } from '@/features/scripts/SalesScriptsPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { LeaderboardPage } from '@/features/leaderboard/LeaderboardPage';
import { AdminPage } from '@/features/admin/AdminPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/change-password',
    element: (
      <AuthGuard>
        <ChangePasswordPage />
      </AuthGuard>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'leads',
        element: <LeadsPage />,
      },
      {
        path: 'leads/:id',
        element: <LeadDetailPage />,
      },
      {
        path: 'journey',
        element: <JourneyPage />,
      },
      {
        path: 'transactions',
        element: <TransactionsPage />,
      },
      {
        path: 'leaderboard',
        element: <LeaderboardPage />,
      },
      {
        path: 'distribution',
        element: <DistributionPage />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'projects/:id',
        element: <ProjectKnowledgePage />,
      },
      {
        path: 'scripts',
        element: <SalesScriptsPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'admin',
        element: (
          <RoleGuard allowedRoles={['admin']}>
            <AdminPage />
          </RoleGuard>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
