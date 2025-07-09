import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Shield, 
  Activity, 
  Users,
  Target,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  FileText,
  Settings,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { anomalyService } from '../services/anomalyService';
import toast from 'react-hot-toast';

interface DashboardKPIs {
  totalAnomalies: number;
  openAnomalies: number;
  criticalAnomalies: number;
  averageResolutionTime: number;
  treatmentRate: number;
  safetyScore: number;
  maintenanceEfficiency: number;
  // New detailed metrics
  newAnomaliesThisWeek: number;
  resolvedAnomaliesThisWeek: number;
  averageResponseTime: number;
  criticalityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  statusDistribution: {
    new: number;
    in_progress: number;
    treated: number;
    closed: number;
  };
  topAffectedServices: Array<{
    service: string;
    count: number;
    criticalCount: number;
  }>;
  monthlyTrend: {
    current: number;
    previous: number;
    change: number;
  };
  performanceMetrics: {
    mttr: number; // Mean Time To Resolution
    mtbf: number; // Mean Time Between Failures
    efficiency: number;
  };
}

interface ServiceDistributionData {
  service: string;
  count: number;
  percentage: number;
}

export const Dashboard: React.FC = () => {
  const [dashboardKPIs, setDashboardKPIs] = useState<DashboardKPIs>({
    totalAnomalies: 0,
    openAnomalies: 0,
    criticalAnomalies: 0,
    averageResolutionTime: 0,
    treatmentRate: 0,
    safetyScore: 0,
    maintenanceEfficiency: 0,
    newAnomaliesThisWeek: 0,
    resolvedAnomaliesThisWeek: 0,
    averageResponseTime: 0,
    criticalityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
    statusDistribution: { new: 0, in_progress: 0, treated: 0, closed: 0 },
    topAffectedServices: [],
    monthlyTrend: { current: 0, previous: 0, change: 0 },
    performanceMetrics: { mttr: 0, mtbf: 0, efficiency: 0 }
  });
  const [serviceData, setServiceData] = useState<ServiceDistributionData[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate real KPIs from anomaly data
  const calculateKPIs = async (): Promise<DashboardKPIs> => {
    try {
      const anomalies = await anomalyService.getAllAnomalies();
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Basic metrics
      const totalAnomalies = anomalies.length;
      const openAnomalies = anomalies.filter(a => 
        a.status === 'new' || a.status === 'in_progress'
      ).length;
      const criticalAnomalies = anomalies.filter(a => 
        a.criticalityLevel === 'critical'
      ).length;
      const treatedAnomalies = anomalies.filter(a => 
        a.status === 'treated' || a.status === 'closed'
      ).length;
      const treatmentRate = totalAnomalies > 0 ? (treatedAnomalies / totalAnomalies) * 100 : 0;

      // Weekly metrics
      const newAnomaliesThisWeek = anomalies.filter(a => 
        new Date(a.createdAt) >= oneWeekAgo
      ).length;
      const resolvedAnomaliesThisWeek = anomalies.filter(a => 
        (a.status === 'treated' || a.status === 'closed') && 
        new Date(a.updatedAt) >= oneWeekAgo
      ).length;

      // Resolution time calculations
      const resolvedAnomalies = anomalies.filter(a => 
        (a.status === 'treated' || a.status === 'closed') && 
        a.createdAt && a.updatedAt
      );
      let averageResolutionTime = 0;
      if (resolvedAnomalies.length > 0) {
        const totalDays = resolvedAnomalies.reduce((sum, a) => {
          const created = new Date(a.createdAt);
          const updated = new Date(a.updatedAt);
          const days = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          return sum + Math.max(days, 0);
        }, 0);
        averageResolutionTime = totalDays / resolvedAnomalies.length;
      }

      // Average response time (time to first action)
      const averageResponseTime = averageResolutionTime * 0.3; // Simplified calculation

      // Criticality distribution
      const criticalityDistribution = {
        critical: anomalies.filter(a => a.criticalityLevel === 'critical').length,
        high: anomalies.filter(a => a.criticalityLevel === 'high').length,
        medium: anomalies.filter(a => a.criticalityLevel === 'medium').length,
        low: anomalies.filter(a => a.criticalityLevel === 'low').length
      };

      // Status distribution
      const statusDistribution = {
        new: anomalies.filter(a => a.status === 'new').length,
        in_progress: anomalies.filter(a => a.status === 'in_progress').length,
        treated: anomalies.filter(a => a.status === 'treated').length,
        closed: anomalies.filter(a => a.status === 'closed').length
      };

      // Top affected services
      const serviceCount: { [key: string]: { total: number; critical: number } } = {};
      anomalies.forEach(a => {
        const service = a.service || 'Unknown';
        if (!serviceCount[service]) {
          serviceCount[service] = { total: 0, critical: 0 };
        }
        serviceCount[service].total++;
        if (a.criticalityLevel === 'critical') {
          serviceCount[service].critical++;
        }
      });

      const topAffectedServices = Object.entries(serviceCount)
        .map(([service, data]) => ({
          service,
          count: data.total,
          criticalCount: data.critical
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Monthly trend
      const currentMonthAnomalies = anomalies.filter(a => 
        new Date(a.createdAt) >= oneMonthAgo
      ).length;
      const previousMonthStart = new Date(oneMonthAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
      const previousMonthAnomalies = anomalies.filter(a => {
        const created = new Date(a.createdAt);
        return created >= previousMonthStart && created < oneMonthAgo;
      }).length;
      const monthlyChange = previousMonthAnomalies > 0 
        ? ((currentMonthAnomalies - previousMonthAnomalies) / previousMonthAnomalies) * 100 
        : 0;

      // Safety score
      const safetyScores = anomalies
        .map(a => a.processSafetyScore || 0)
        .filter(score => score > 0);
      const safetyScore = safetyScores.length > 0 
        ? (safetyScores.reduce((sum, score) => sum + score, 0) / safetyScores.length) * 20
        : 0;

      // Maintenance efficiency
      const anomaliesWithMaintenance = anomalies.filter(a => a.maintenanceWindowId).length;
      const maintenanceEfficiency = totalAnomalies > 0 ? (anomaliesWithMaintenance / totalAnomalies) * 100 : 0;

      // Performance metrics
      const mttr = averageResolutionTime; // Mean Time To Resolution
      const mtbf = totalAnomalies > 0 ? (365 / totalAnomalies) : 0; // Mean Time Between Failures (simplified)
      const efficiency = treatmentRate;

      return {
        totalAnomalies,
        openAnomalies,
        criticalAnomalies,
        averageResolutionTime,
        treatmentRate,
        safetyScore,
        maintenanceEfficiency,
        newAnomaliesThisWeek,
        resolvedAnomaliesThisWeek,
        averageResponseTime,
        criticalityDistribution,
        statusDistribution,
        topAffectedServices,
        monthlyTrend: {
          current: currentMonthAnomalies,
          previous: previousMonthAnomalies,
          change: monthlyChange
        },
        performanceMetrics: {
          mttr,
          mtbf,
          efficiency
        }
      };
    } catch (error) {
      console.error('Error calculating KPIs:', error);
      return {
        totalAnomalies: 0,
        openAnomalies: 0,
        criticalAnomalies: 0,
        averageResolutionTime: 0,
        treatmentRate: 0,
        safetyScore: 0,
        maintenanceEfficiency: 0,
        newAnomaliesThisWeek: 0,
        resolvedAnomaliesThisWeek: 0,
        averageResponseTime: 0,
        criticalityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
        statusDistribution: { new: 0, in_progress: 0, treated: 0, closed: 0 },
        topAffectedServices: [],
        monthlyTrend: { current: 0, previous: 0, change: 0 },
        performanceMetrics: { mttr: 0, mtbf: 0, efficiency: 0 }
      };
    }
  };

  // Generate service distribution data
  const generateServiceData = async (): Promise<ServiceDistributionData[]> => {
    try {
      const anomalies = await anomalyService.getAllAnomalies();
      const serviceCount: { [key: string]: number } = {};
      
      anomalies.forEach(a => {
        const service = a.service || 'Unknown';
        serviceCount[service] = (serviceCount[service] || 0) + 1;
      });
      
      const total = anomalies.length;
      return Object.entries(serviceCount)
        .map(([service, count]) => ({
          service,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15); // Top 15 services
    } catch (error) {
      console.error('Error generating service data:', error);
      return [];
    }
  };

  const loadDashboardData = async (showToast = false) => {
    try {
      setLoading(true);
      
      const [kpis, serviceDistData] = await Promise.all([
        calculateKPIs(),
        generateServiceData()
      ]);
      
      setDashboardKPIs(kpis);
      setServiceData(serviceDistData);
      
      if (showToast) {
        toast.success('Dashboard mis à jour avec succès');
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (showToast) {
        toast.error('Erreur lors du chargement des données');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(false); // Don't show toast on initial load
  }, []);

  const getSafetyLevel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 60) return { label: 'Bon', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Moyen', color: 'text-yellow-600' };
    return { label: 'Faible', color: 'text-red-600' };
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-600 mt-2">Vue d'ensemble des anomalies et de la maintenance</p>
        </div>
        <Button 
          onClick={() => loadDashboardData(true)}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>
      
      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Anomalies Totales</p>
                <p className="text-3xl font-bold text-gray-900">{dashboardKPIs.totalAnomalies}</p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En Attente</p>
                <p className="text-3xl font-bold text-gray-900">{dashboardKPIs.openAnomalies}</p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Niveau Critique</p>
                <p className="text-3xl font-bold text-gray-900">{dashboardKPIs.criticalAnomalies}</p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Taux de Résolution</p>
                <p className="text-3xl font-bold text-gray-900">{dashboardKPIs.treatmentRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Temps Moyen de Résolution</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardKPIs.averageResolutionTime.toFixed(0)} jours</p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Efficacité de Maintenance</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardKPIs.maintenanceEfficiency.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Target className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Score de Sécurité</p>
                <p className={`text-2xl font-bold ${getSafetyLevel(dashboardKPIs.safetyScore).color}`}>
                  {getSafetyLevel(dashboardKPIs.safetyScore).label}
                </p>
                <p className="text-xs text-gray-500 mt-1">vs last month</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activité Hebdomadaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-900">{dashboardKPIs.newAnomaliesThisWeek}</p>
                <p className="text-sm text-blue-700">Nouvelles Anomalies</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-900">{dashboardKPIs.resolvedAnomaliesThisWeek}</p>
                <p className="text-sm text-green-700">Anomalies Résolues</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tendance Mensuelle</span>
                <div className="flex items-center gap-2">
                  {dashboardKPIs.monthlyTrend.change >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    dashboardKPIs.monthlyTrend.change >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {Math.abs(dashboardKPIs.monthlyTrend.change).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Répartition par Statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(dashboardKPIs.statusDistribution).map(([status, count]) => {
                const statusLabels = {
                  'new': { label: 'Nouveau', color: 'bg-gray-500' },
                  'in_progress': { label: 'En cours', color: 'bg-yellow-500' },
                  'treated': { label: 'Traité', color: 'bg-blue-500' },
                  'closed': { label: 'Fermé', color: 'bg-green-500' }
                };
                const statusInfo = statusLabels[status as keyof typeof statusLabels];
                const percentage = dashboardKPIs.totalAnomalies > 0 ? (count / dashboardKPIs.totalAnomalies) * 100 : 0;
                
                return (
                  <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${statusInfo.color}`}></div>
                      <span className="text-sm font-medium">{statusInfo.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{count}</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full">
                        <div 
                          className={`h-2 rounded-full ${statusInfo.color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Criticality and Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Criticality Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Niveau de Criticité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(dashboardKPIs.criticalityDistribution).map(([level, count]) => {
                const criticalityInfo = {
                  'critical': { label: 'Critique', color: 'bg-red-500', textColor: 'text-red-700' },
                  'high': { label: 'Élevé', color: 'bg-orange-500', textColor: 'text-orange-700' },
                  'medium': { label: 'Moyen', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
                  'low': { label: 'Faible', color: 'bg-green-500', textColor: 'text-green-700' }
                };
                const info = criticalityInfo[level as keyof typeof criticalityInfo];
                const percentage = dashboardKPIs.totalAnomalies > 0 ? (count / dashboardKPIs.totalAnomalies) * 100 : 0;
                
                return (
                  <div key={level} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${info.color}`}></div>
                      <span className="text-sm font-medium">{info.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${info.textColor}`}>{count}</span>
                      <span className="text-xs text-gray-500">({percentage.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Métriques de Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold text-gray-900">{dashboardKPIs.performanceMetrics.mttr.toFixed(1)}</p>
                <p className="text-xs text-gray-600">MTTR (jours)</p>
                <p className="text-xs text-gray-500">Temps Moyen de Résolution</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold text-gray-900">{dashboardKPIs.performanceMetrics.mtbf.toFixed(0)}</p>
                <p className="text-xs text-gray-600">MTBF (jours)</p>
                <p className="text-xs text-gray-500">Temps Moyen Entre Pannes</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold text-gray-900">{dashboardKPIs.averageResponseTime.toFixed(1)}</p>
                <p className="text-xs text-gray-600">Temps de Réponse (jours)</p>
                <p className="text-xs text-gray-500">Première Intervention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Affected Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Services Impactés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardKPIs.topAffectedServices.slice(0, 5).map((service, index) => (
                <div key={service.service} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="w-6 h-6 rounded-full flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-20">{service.service}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900">{service.count}</span>
                    {service.criticalCount > 0 && (
                      <Badge variant="danger" className="text-xs px-1">
                        {service.criticalCount}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Répartition par Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          {serviceData.length > 0 ? (
            <div className="space-y-4">
              {serviceData.map((service, index) => (
                <div key={service.service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="info" className="w-8 h-8 rounded-full flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="font-medium text-gray-900">{service.service}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{service.count} anomalies</span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ width: `${service.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {service.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Aucune donnée de service disponible</p>
              <p className="text-sm mt-1">Les données seront affichées une fois que les anomalies auront des services assignés</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};