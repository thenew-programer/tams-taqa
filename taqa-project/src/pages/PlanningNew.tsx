import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  BarChart3,
  Eye,
  Cpu,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { 
  TreatedAnomaliesPanel,
  WindowManagementGrid,
  PlanningStats,
  AutoScheduler,
  QuickActions,
  PlanningAnalytics,
  CalendarPlanningView
} from '../components/planning/new';
import { CreateWindowModal, WindowCreationData } from '../components/planning/new/CreateWindowModal';
import { WindowDetailModal } from '../components/planning/new/WindowDetailModal';
import { useData } from '../contexts/DataContext';
import { usePlanningEngineReal } from '../hooks/usePlanningEngineReal';
import { MaintenanceWindow } from '../types';
import toast from 'react-hot-toast';

export const PlanningNew: React.FC = () => {
  const { 
    anomalies, 
    maintenanceWindows, 
    actionPlans,
    addMaintenanceWindow,
    updateMaintenanceWindow,
    updateAnomaly 
  } = useData();

  // Planning engine hook for intelligent scheduling (using real backend)
  const planningEngine = usePlanningEngineReal();

  // UI State
  const [activeView, setActiveView] = useState<'overview' | 'windows' | 'analytics' | 'algorithm'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'urgent' | 'scheduled' | 'unscheduled'>('all');
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [triggeringAnomaly, setTriggeringAnomaly] = useState<string | undefined>();
  
  // Window detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState<MaintenanceWindow | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');

  // Computed data
  const treatedAnomalies = useMemo(() => 
    anomalies.filter(anomaly => anomaly.status === 'treated'),
    [anomalies]
  );

  const unscheduledTreatedAnomalies = useMemo(() =>
    treatedAnomalies.filter(anomaly => !anomaly.maintenanceWindowId),
    [treatedAnomalies]
  );

  const scheduledTreatedAnomalies = useMemo(() =>
    treatedAnomalies.filter(anomaly => !!anomaly.maintenanceWindowId),
    [treatedAnomalies]
  );

  const availableWindows = useMemo(() =>
    maintenanceWindows.filter(window => 
      window.status === 'planned' && 
      new Date(window.startDate) > new Date()
    ),
    [maintenanceWindows]
  );

  // Auto-schedule treated anomalies
  const handleAutoSchedule = useCallback(async () => {
    if (unscheduledTreatedAnomalies.length === 0) return;

    try {
      const scheduleResults = await planningEngine.autoScheduleTreatedAnomalies(
        unscheduledTreatedAnomalies,
        availableWindows,
        actionPlans
      );

      // Apply scheduling results
      if (scheduleResults.assignments && scheduleResults.assignments.length > 0) {
        scheduleResults.assignments.forEach((assignment: any) => {
          updateAnomaly(assignment.anomalyId, {
            maintenanceWindowId: assignment.windowId
          });
        });
      }

      // Create new windows if needed (they should already be created by the backend)
      if (scheduleResults.newWindows && scheduleResults.newWindows.length > 0) {
        // Windows are already created in the database by the backend service
        console.log(`${scheduleResults.newWindows.length} new windows created by backend`);
      }

      if (scheduleResults.assignments && scheduleResults.assignments.length > 0) {
        toast.success(
          `${scheduleResults.assignments.length} anomalies automatically scheduled`,
          { duration: 3000 }
        );
      }

    } catch (error) {
      console.error('Auto-scheduling error:', error);
      toast.error('Auto-scheduling failed');
    }
  }, [unscheduledTreatedAnomalies, availableWindows, actionPlans, planningEngine, updateAnomaly]);

  // Auto-scheduling effect
  useEffect(() => {
    if (autoScheduleEnabled && unscheduledTreatedAnomalies.length > 0) {
      const timer = setTimeout(() => {
        handleAutoSchedule();
      }, 2000); // Delay to prevent excessive calls

      return () => clearTimeout(timer);
    }
  }, [unscheduledTreatedAnomalies, autoScheduleEnabled, handleAutoSchedule]);

  // Manual scheduling
  const handleManualSchedule = async (anomalyId: string, windowId: string) => {
    try {
      updateAnomaly(anomalyId, { maintenanceWindowId: windowId });
      
      const anomaly = anomalies.find(a => a.id === anomalyId);
      const window = maintenanceWindows.find(w => w.id === windowId);
      
      toast.success(
        `"${anomaly?.title}" scheduled to ${window?.type} maintenance window`
      );
    } catch (error) {
      toast.error('Failed to schedule anomaly');
    }
  };

  // Create new maintenance window - opens modal
  const handleCreateWindow = async (anomalyIdOrDate?: string | Date) => {
    if (typeof anomalyIdOrDate === 'string') {
      setTriggeringAnomaly(anomalyIdOrDate);
    } else {
      setTriggeringAnomaly(undefined);
      // TODO: Use the date for pre-filling the modal if needed
    }
    setShowCreateModal(true);
  };

  // Handle window creation from modal
  const handleCreateWindowFromModal = async (windowData: WindowCreationData) => {
    try {
      // Map 'arret' type to 'minor' for backend compatibility
      const backendType: 'force' | 'minor' | 'major' = windowData.type === 'arret' ? 'minor' : windowData.type;

      // Create the window using the planning engine
      const newWindow = await planningEngine.createOptimalWindow(
        windowData.autoAssignAnomalies,
        actionPlans
      );

      // Update window with custom data
      const updatedWindow = {
        ...newWindow,
        type: backendType,
        durationDays: windowData.durationDays,
        startDate: windowData.startDate,
        endDate: windowData.endDate,
        description: windowData.description
      };

      addMaintenanceWindow(updatedWindow);

      // Assign anomalies to the window
      for (const anomalyId of windowData.autoAssignAnomalies) {
        updateAnomaly(anomalyId, { maintenanceWindowId: updatedWindow.id });
      }

      // TODO: Store scheduling details (dates and hours) in database
      // This would require extending the anomaly model or creating a scheduling table
      console.log('Scheduled times:', windowData.scheduledTimes);

      toast.success(`Fenêtre de maintenance ${windowData.type} créée avec ${windowData.autoAssignAnomalies.length} anomalie(s)`);
    } catch (error) {
      console.error('Error creating window:', error);
      toast.error('Erreur lors de la création de la fenêtre');
      throw error;
    }
  };

  // Batch operations
  const handleBatchSchedule = async (anomalyIds: string[], windowId: string) => {
    try {
      const updatePromises = anomalyIds.map(id => 
        updateAnomaly(id, { maintenanceWindowId: windowId })
      );
      
      await Promise.all(updatePromises);
      toast.success(`${anomalyIds.length} anomalies scheduled`);
    } catch (error) {
      toast.error('Batch scheduling failed');
    }
  };

  const handleOptimizeScheduling = async () => {
    try {
      const optimizationResults = await planningEngine.optimizeScheduling(
        treatedAnomalies,
        maintenanceWindows,
        actionPlans
      );

      // Apply optimizations (already applied by backend service)
      if (optimizationResults.reassignments && optimizationResults.reassignments.length > 0) {
        // Reassignments are already applied in the database by the backend service
        console.log(`${optimizationResults.reassignments.length} reassignments applied by backend`);
      }

      toast.success(
        `Scheduling optimized: ${optimizationResults.reassignments?.length || 0} changes applied`
      );
    } catch (error) {
      toast.error('Optimization failed');
    }
  };

  // Window detail modal handlers
  const handleViewWindow = (window: MaintenanceWindow) => {
    setSelectedWindow(window);
    setModalMode('view');
    setShowDetailModal(true);
  };

  const handleEditWindow = (window: MaintenanceWindow) => {
    setSelectedWindow(window);
    setModalMode('edit');
    setShowDetailModal(true);
  };

  const handleUpdateWindowFromModal = async (windowId: string, updates: Partial<MaintenanceWindow>) => {
    try {
      updateMaintenanceWindow(windowId, updates);
      toast.success('Window updated successfully');
      setShowDetailModal(false);
    } catch (error) {
      toast.error('Failed to update window');
      throw error;
    }
  };

  // Advanced planning algorithms
  const planningAlgorithm = useMemo(() => {
    const calculateOptimalScheduling = () => {
      // Enhanced Weighted Shortest Processing Time with Multiple Constraints
      const treatedAnomaliesData = treatedAnomalies.map(anomaly => {
        const actionPlan = actionPlans.find(ap => ap.anomalyId === anomaly.id);
        const criticalityWeight = {
          'critical': 10,
          'high': 7,
          'medium': 4,
          'low': 1
        }[anomaly.criticalityLevel] || 1;

        const equipmentFactor = anomaly.equipmentId ? 1.2 : 1.0;
        const urgencyScore = criticalityWeight * equipmentFactor;
        const processingTime = actionPlan?.totalDurationDays || 1;
        
        return {
          ...anomaly,
          urgencyScore,
          processingTime,
          efficiency: urgencyScore / processingTime, // Priority ratio
          actionPlan
        };
      });

      // Sort by efficiency (urgency/processing time ratio) - higher is better
      const sortedAnomalies = treatedAnomaliesData.sort((a, b) => b.efficiency - a.efficiency);

      // Calculate window utilization and recommendations
      const windowAnalysis = maintenanceWindows.map(window => {
        const assignedAnomalies = treatedAnomalies.filter(a => a.maintenanceWindowId === window.id);
        const totalWorkload = assignedAnomalies.reduce((sum, anomaly) => {
          const plan = actionPlans.find(ap => ap.anomalyId === anomaly.id);
          return sum + (plan?.totalDurationDays || 1);
        }, 0);

        const capacity = window.durationDays;
        const utilization = capacity > 0 ? (totalWorkload / capacity) * 100 : 0;
        
        // Calculate optimal assignment score
        const criticalityBalance = assignedAnomalies.reduce((acc, anomaly) => {
          acc[anomaly.criticalityLevel] = (acc[anomaly.criticalityLevel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const balanceScore = Object.keys(criticalityBalance).length * 10; // Diversity bonus
        const efficiencyScore = Math.max(0, 100 - Math.abs(85 - utilization)); // Target 85% utilization

        return {
          ...window,
          assignedAnomalies,
          utilization,
          capacity,
          totalWorkload,
          balanceScore,
          efficiencyScore,
          overallScore: (balanceScore + efficiencyScore) / 2
        };
      });

      return {
        sortedAnomalies,
        windowAnalysis,
        recommendations: generateRecommendations(sortedAnomalies, windowAnalysis)
      };
    };

    const generateRecommendations = (anomalies: any[], windows: any[]) => {
      const recommendations = [];

      // Identify overloaded windows
      const overloadedWindows = windows.filter(w => w.utilization > 100);
      if (overloadedWindows.length > 0) {
        recommendations.push({
          type: 'warning',
          title: 'Fenêtres Surchargées',
          description: `${overloadedWindows.length} fenêtre(s) dépassent leur capacité`,
          action: 'Redistribuer les anomalies ou étendre la durée'
        });
      }

      // Identify underutilized windows
      const underutilizedWindows = windows.filter(w => w.utilization < 50 && w.utilization > 0);
      if (underutilizedWindows.length > 0) {
        recommendations.push({
          type: 'info',
          title: 'Capacité Disponible',
          description: `${underutilizedWindows.length} fenêtre(s) peuvent accueillir plus d\'anomalies`,
          action: 'Programmer des anomalies supplémentaires'
        });
      }

      // Unscheduled critical anomalies
      const unscheduledCritical = anomalies.filter(a => 
        !a.maintenanceWindowId && a.criticalityLevel === 'critical'
      );
      if (unscheduledCritical.length > 0) {
        recommendations.push({
          type: 'error',
          title: 'Anomalies Critiques Non Programmées',
          description: `${unscheduledCritical.length} anomalie(s) critiques nécessitent une attention immédiate`,
          action: 'Créer une fenêtre d\'urgence ou réorganiser les priorités'
        });
      }

      return recommendations;
    };

    return calculateOptimalScheduling();
  }, [treatedAnomalies, maintenanceWindows, actionPlans]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20">
      {/* Enhanced Header with Glass Effect */}
      <div className="mb-8 relative">
        {/* Background blur effect */}
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm border-b border-gray-200/50" />
        
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                Smart Planning System
              </h1>
              <p className="text-gray-600 text-lg font-medium ml-16">
                Intelligence artificielle pour la planification de maintenance avancée
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Enhanced Auto-schedule toggle */}
              <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200/50">
                <div className={`w-4 h-4 rounded-full shadow-sm transition-all duration-300 ${
                  autoScheduleEnabled 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-200' 
                    : 'bg-gray-400'
                }`} />
                <span className="text-sm font-semibold text-gray-700">Auto-Schedule</span>
                <Button
                  variant={autoScheduleEnabled ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setAutoScheduleEnabled(!autoScheduleEnabled)}
                  className={`transition-all duration-300 ${
                    autoScheduleEnabled 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {autoScheduleEnabled ? 'ON' : 'OFF'}
                </Button>
              </div>

              {/* Enhanced Quick actions */}
              <QuickActions
                onCreateWindow={() => handleCreateWindow()}
                onOptimize={handleOptimizeScheduling}
                onAutoSchedule={handleAutoSchedule}
                unscheduledCount={unscheduledTreatedAnomalies.length}
              />
            </div>
          </div>

          {/* Enhanced Navigation with Glass Effect */}
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-gray-200/50 w-fit">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3, color: 'blue' },
              { id: 'windows', label: 'Fenêtres', icon: Calendar, color: 'indigo' },
              { id: 'analytics', label: 'Analytiques', icon: Eye, color: 'purple' },
              { id: 'algorithm', label: 'Algorithme', icon: Cpu, color: 'teal' }
            ].map(tab => (
              <Button
                key={tab.id}
                variant={activeView === tab.id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveView(tab.id as any)}
                className={`flex items-center gap-2 transition-all duration-300 ${
                  activeView === tab.id 
                    ? `bg-gradient-to-r from-${tab.color}-600 to-${tab.color}-700 text-white shadow-lg transform scale-105` 
                    : 'hover:bg-gray-100/80 text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {/* Stats Overview */}
      <PlanningStats
        treatedAnomalies={treatedAnomalies}
        unscheduledCount={unscheduledTreatedAnomalies.length}
        scheduledCount={scheduledTreatedAnomalies.length}
        availableWindows={availableWindows.length}
        totalWindows={maintenanceWindows.length}
      />

      {/* Enhanced Main Content with Glass Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 px-6">
        {/* Left Panel - Treated Anomalies with Enhanced Styling */}
        <div className="lg:col-span-1">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-200/50 overflow-hidden">
            <TreatedAnomaliesPanel
              anomalies={treatedAnomalies}
              unscheduledAnomalies={unscheduledTreatedAnomalies}
              onSchedule={handleManualSchedule}
              onCreateWindow={handleCreateWindow}
              onBatchSchedule={handleBatchSchedule}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
            />
          </div>
        </div>

        {/* Right Panel - Windows Management with Enhanced Styling */}
        <div className="lg:col-span-2">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-200/50 overflow-hidden">
            {activeView === 'overview' && (
              <WindowManagementGrid
                windows={maintenanceWindows}
                anomalies={treatedAnomalies}
                actionPlans={actionPlans}
                onScheduleAnomaly={handleManualSchedule}
                onCreateWindow={handleCreateWindow}
                onUpdateWindow={updateMaintenanceWindow}
                onViewWindow={handleViewWindow}
                onEditWindow={handleEditWindow}
              />
            )}

            {activeView === 'windows' && (
              <CalendarPlanningView
                windows={maintenanceWindows}
                anomalies={treatedAnomalies}
                actionPlans={actionPlans}
                onViewWindow={handleViewWindow}
                onEditWindow={handleEditWindow}
                onCreateWindow={handleCreateWindow}
              />
            )}

            {activeView === 'analytics' && (
              <PlanningAnalytics
                windows={maintenanceWindows}
                anomalies={anomalies}
                actionPlans={actionPlans}
              />
            )}

            {activeView === 'algorithm' && (
              <div className="p-6 space-y-8">
                {/* Enhanced Algorithm Overview Card */}
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 border border-blue-200/50 shadow-lg">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                      <Cpu className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
                        Algorithme de Planification Intelligent
                      </h2>
                      <p className="text-gray-600 font-medium">Optimisation multi-contraintes avec pondération dynamique</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-blue-100/50 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <Target className="h-6 w-6 text-blue-600" />
                        <span className="font-bold text-gray-900">Algorithme</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">Weighted Shortest Processing Time + Contraintes multiples</p>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-green-100/50 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                        <span className="font-bold text-gray-900">Optimisation</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">Ratio Urgence/Temps + Équilibrage des charges</p>
                    </div>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-purple-100/50 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <Zap className="h-6 w-6 text-purple-600" />
                        <span className="font-bold text-gray-900">Performance</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Efficacité {planningAlgorithm.windowAnalysis.length > 0 ? Math.round(planningAlgorithm.windowAnalysis.reduce((sum, w) => sum + w.efficiencyScore, 0) / planningAlgorithm.windowAnalysis.length) : 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enhanced Algorithm Results */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Enhanced Sorted Anomalies by Priority */}
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                        <Target className="h-6 w-6 text-white" />
                      </div>
                      Priorités Calculées
                    </h3>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {planningAlgorithm.sortedAnomalies.slice(0, 10).map((anomaly, index) => (
                        <div key={anomaly.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-xl border border-gray-200/50 hover:shadow-md transition-all duration-300">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{anomaly.title}</p>
                              <p className="text-xs text-gray-500">{anomaly.equipmentId}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm font-bold text-blue-600">
                              {anomaly.efficiency.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Score: {anomaly.urgencyScore}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enhanced Window Analysis */}
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-green-500 to-green-600 rounded-lg">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                      Analyse des Fenêtres
                    </h3>
                    
                    <div className="space-y-6">
                      {planningAlgorithm.windowAnalysis.map((window) => (
                        <div key={window.id} className="p-5 border border-gray-200/50 rounded-xl bg-gradient-to-r from-white to-gray-50/50 hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">{window.type.toUpperCase()}</h4>
                              <p className="text-sm text-gray-500">{window.assignedAnomalies.length} anomalies</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{window.utilization.toFixed(1)}%</div>
                              <div className="text-xs text-gray-500">Score: {window.overallScore.toFixed(1)}</div>
                            </div>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-3 mb-3 shadow-inner">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${
                                window.utilization > 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                window.utilization > 85 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                window.utilization > 50 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'
                              }`}
                              style={{ width: `${Math.min(window.utilization, 100)}%` }}
                            />
                          </div>
                          
                          <div className="flex justify-between text-sm text-gray-600">
                            <span className="font-medium">Charge: {window.totalWorkload}j / {window.capacity}j</span>
                            <span className={`font-semibold ${
                              window.utilization > 100 ? 'text-red-600' : 
                              window.utilization < 50 ? 'text-blue-600' : 'text-green-600'
                            }`}>
                              {window.utilization > 100 ? 'Surcharge!' : window.utilization < 50 ? 'Sous-utilisé' : 'Optimal'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Enhanced Recommendations */}
                {planningAlgorithm.recommendations.length > 0 && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      Recommandations Algorithmiques
                    </h3>
                    
                    <div className="space-y-4">
                      {planningAlgorithm.recommendations.map((rec, index) => (
                        <div 
                          key={index}
                          className={`p-5 rounded-xl border-l-4 transition-all duration-300 hover:shadow-md ${
                            rec.type === 'error' ? 'bg-gradient-to-r from-red-50 to-red-50/50 border-red-500' :
                            rec.type === 'warning' ? 'bg-gradient-to-r from-yellow-50 to-orange-50/50 border-yellow-500' :
                            'bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-500'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <h4 className="font-bold text-gray-900 text-lg">{rec.title}</h4>
                              <p className="text-sm text-gray-600 leading-relaxed">{rec.description}</p>
                              <p className="text-xs text-gray-500 italic font-medium">Action recommandée: {rec.action}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Auto Scheduler Component */}
      {autoScheduleEnabled && (
        <div className="px-6 mt-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
            <AutoScheduler
              treatedAnomalies={unscheduledTreatedAnomalies}
              onScheduleComplete={handleAutoSchedule}
              enabled={autoScheduleEnabled}
            />
          </div>
        </div>
      )}

      {/* Enhanced Create Window Modal */}
      <CreateWindowModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setTriggeringAnomaly(undefined);
        }}
        onCreateWindow={handleCreateWindowFromModal}
        triggeringAnomaly={triggeringAnomaly ? anomalies.find(a => a.id === triggeringAnomaly) : undefined}
        availableAnomalies={unscheduledTreatedAnomalies}
      />

      {/* Enhanced Window Detail Modal with Error Handling */}
      {selectedWindow && showDetailModal && (
        <WindowDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedWindow(null);
            setModalMode('view');
          }}
          window={selectedWindow}
          anomalies={anomalies.filter(a => a.maintenanceWindowId === selectedWindow.id)}
          actionPlans={actionPlans}
          mode={modalMode}
          onSwitchMode={setModalMode}
          onUpdateWindow={handleUpdateWindowFromModal}
        />
      )}
    </div>
  );
};
