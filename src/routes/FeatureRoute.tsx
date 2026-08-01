import { Navigate, Outlet } from 'react-router-dom'
import { useFeatures, type FeatureKey } from '@/hooks/useFeatures'

interface FeatureRouteProps {
  feature: FeatureKey
}

// Bloqueia o acesso direto pela URL a uma função que a empresa não tem liberada
// (o menu já esconde; isto fecha a porta de quem digita a rota na mão).
export function FeatureRoute({ feature }: FeatureRouteProps) {
  const { hasFeature } = useFeatures()
  return hasFeature(feature) ? <Outlet /> : <Navigate to="/dashboard" replace />
}
