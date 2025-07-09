import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Wrench,
  Paperclip, 
  MessageSquare, 
  Clock, 
  User, 
  AlertTriangle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ActionPlanModal } from '../components/anomalies/ActionPlanModal';
import { ActionPlanDetails } from '../components/anomalies/ActionPlanDetails';
import { REXFileUpload } from '../components/anomalies/REXFileUpload';
import { PredictionApproval } from '../components/anomalies/PredictionApproval';
import { useData } from '../contexts/DataContext';
import { formatDateTime, getCriticalityColor } from '../lib/utils';
import { ActionPlan } from '../types';
import { planningIntegration } from '../lib/planningUtils';
import toast from 'react-hot-toast';

export const AnomalyDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAnomalyById, addActionPlan, updateActionPlan, updateAnomaly, actionPlans, getActionPlanByAnomalyId } = useData();
  
  // Find the anomaly (in a real app, this would be fetched from an API)
  const anomaly = id ? getAnomalyById(id) : undefined;
  
  const [showActionPlan, setShowActionPlan] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [actionPlan, setActionPlan] = useState<ActionPlan | undefined>(undefined);
  const [rexFileRefresh, setRexFileRefresh] = useState(0);
  const [hasRexFile, setHasRexFile] = useState(false);

  // Load action plan when component mounts
  useEffect(() => {
    const loadActionPlan = async () => {
      if (anomaly?.id) {
        try {
          const plan = await getActionPlanByAnomalyId(anomaly.id);
          if (plan) {
            setActionPlan(plan);
          }
        } catch (error) {
          console.error('Error loading action plan:', error);
        }
      }
    };

    loadActionPlan();
  }, [anomaly?.id, getActionPlanByAnomalyId]);

  const statusOptions = [
    { value: 'new', label: 'Nouveau' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'treated', label: 'Traité' },
    { value: 'closed', label: 'Fermé' }
  ];
  
  if (!anomaly) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Anomalie non trouvée</h2>
        <p className="text-gray-600 mb-4">L'anomalie demandée n'existe pas ou a été supprimée.</p>
        <Button onClick={() => navigate('/anomalies')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la liste
        </Button>
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'new': return 'info';
      case 'in_progress': return 'warning';
      case 'treated': return 'success';
      case 'closed': return 'default';
      default: return 'default';
    }
  };

  const handleSaveActionPlan = async (actionPlan: ActionPlan) => {
    try {
      console.log('Saving action plan:', actionPlan);
      
      if (actionPlan.id && actionPlans.find(p => p.id === actionPlan.id)) {
        // Update existing action plan
        await updateActionPlan(actionPlan.id, {
          needsOutage: actionPlan.needsOutage,
          outageType: actionPlan.outageType,
          outageDuration: actionPlan.outageDuration,
          plannedDate: actionPlan.plannedDate,
          estimatedCost: actionPlan.estimatedCost,
          priority: actionPlan.priority,
          comments: actionPlan.comments,
          status: actionPlan.status
        });
      } else {
        // Create new action plan
        await addActionPlan({
          anomalyId: anomaly.id,
          needsOutage: actionPlan.needsOutage,
          outageType: actionPlan.outageType,
          outageDuration: actionPlan.outageDuration,
          plannedDate: actionPlan.plannedDate,
          estimatedCost: actionPlan.estimatedCost || 0,
          priority: actionPlan.priority,
          comments: actionPlan.comments || '',
          actions: actionPlan.actions.map(action => ({
            action: action.action,
            responsable: action.responsable,
            pdrsDisponible: action.pdrsDisponible,
            ressourcesInternes: action.ressourcesInternes,
            ressourcesExternes: action.ressourcesExternes,
            dureeHeures: action.dureeHeures,
            dureeJours: action.dureeJours,
            dateDebut: action.dateDebut,
            dateFin: action.dateFin
          }))
        });
      }
      
      setActionPlan(actionPlan);
      toast.success('Plan d\'action sauvegardé avec succès');
    } catch (error) {
      console.error('Error saving action plan:', error);
      toast.error('Erreur lors de la sauvegarde du plan d\'action');
    }
  };

  const handleUpdatePlanning = (actionPlan: ActionPlan) => {
    // In a real app, this would update the planning via API
    console.log('Updating planning with action plan:', actionPlan);
    
    if (actionPlan.outageType === 'force') {
      // Create urgent outage
      const urgentWindow = planningIntegration.createUrgentOutage(actionPlan);
      console.log('Created urgent maintenance window:', urgentWindow);
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    // In a real app, this would make an API call
    toast.success('Commentaire ajouté');
    setNewComment('');
  };
  
  const handleAnomalyStatusUpdate = async (anomalyId: string, status: 'new' | 'in_progress' | 'treated' | 'closed') => {
    if (!anomaly) return;
    
    try {
      // Update the anomaly status
      await updateAnomaly(anomalyId, { status });
      toast.success(`Statut de l'anomalie mis à jour: ${status}`);
    } catch (error) {
      console.error('Error updating anomaly status:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  // Handle anomaly updates from PredictionApproval component
  const handleAnomalyUpdate = () => {
    // Simple reload for now - in a real app, this would update the context
    window.location.reload();
  };

  const handleCloseAnomaly = async () => {
    if (!anomaly) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir clôturer cette anomalie? Cette action est irréversible.')) {
      return;
    }
    
    try {
      await updateAnomaly(anomaly.id, { status: 'closed' });
      toast.success('Anomalie clôturée avec succès');
      // Redirect back to anomalies list after closing
      setTimeout(() => navigate('/anomalies'), 1500);
    } catch (error) {
      console.error('Error closing anomaly:', error);
      toast.error('Erreur lors de la clôture de l\'anomalie');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/anomalies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getCriticalityColor(anomaly.criticalityLevel)}`} />
            <h1 className="text-2xl font-bold text-gray-900">Détail de l'Anomalie</h1>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={() => setShowActionPlan(true)}
            variant={actionPlan ? 'outline' : 'primary'}
          >
            <Wrench className="h-4 w-4 mr-2" />
            {actionPlan ? 'Modifier Plan' : 'Plan d\'Action'}
          </Button>

          {actionPlan && (
            <div className="flex items-center space-x-2">
              <Badge variant={
          actionPlan.status === 'completed' ? 'success' :
          actionPlan.status === 'in_progress' ? 'warning' :
          actionPlan.status === 'approved' ? 'info' : 'default'
        }>
          {actionPlan.completionPercentage}% terminé
        </Badge>
        {actionPlan.needsOutage && (
          <Badge variant="warning">
            Arrêt requis
          </Badge>
        )}
      </div>
    )}
  </div>
</div>

        

      {/* Action Plan Modal */}
      <ActionPlanModal
        isOpen={showActionPlan}
        onClose={() => setShowActionPlan(false)}
        onSave={handleSaveActionPlan}
        onUpdatePlanning={handleUpdatePlanning}
        anomaly={anomaly}
        existingActionPlan={actionPlan}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Informations Générales</span>
                {actionPlan && (
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-gray-500">Plan d'action:</div>
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${actionPlan.completionPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {actionPlan.completionPercentage}%
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titre</label>
                <p className="text-gray-900">{anomaly.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <p className="text-gray-900">{anomaly.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Équipement</label>
                  <p className="text-gray-900">{anomaly.equipmentId}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
                  <p className="text-gray-900">{anomaly.service}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Responsable</label>
                  <p className="text-gray-900">{anomaly.responsiblePerson}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Plan Summary */}
          {actionPlan && (
            <ActionPlanDetails 
              actionPlan={actionPlan} 
              anomaly={anomaly} 
              onActionPlanUpdate={setActionPlan} 
              onAnomalyStatusUpdate={handleAnomalyStatusUpdate} 
            />
          )}
          
          {/* REX File Upload - Only visible when anomaly is treated */}
          <div className="mb-6">
            <REXFileUpload 
              key={`rex-${anomaly.id}-${rexFileRefresh}`}
              anomalyId={anomaly.id}
              isEnabled={anomaly.status === 'treated'} 
              onFileUploaded={() => setRexFileRefresh(prev => prev + 1)}
              onFileStatusChange={setHasRexFile}
            />
          </div>

          {/* Close Anomaly Button - Only visible when anomaly is treated and has REX file */}
          {anomaly.status === 'treated' && hasRexFile && (
            <div className="mb-6">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-green-800 mb-2">
                        Prêt pour la clôture
                      </h3>
                      <p className="text-sm text-green-700">
                        L'anomalie est traitée et le fichier REX a été ajouté. Vous pouvez maintenant clôturer cette anomalie.
                      </p>
                    </div>
                    <Button
                      onClick={handleCloseAnomaly}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Clôturer l'anomalie
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Predictions */}
          <PredictionApproval 
            anomaly={anomaly}
            onUpdate={handleAnomalyUpdate}
          />

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Commentaires & REX</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Add Comment */}
                <div className="flex space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ajouter un commentaire ou un retour d'expérience..."
                      rows={3}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                    Ajouter
                  </Button>
                </div>

                {/* Existing Comments */}
                <div className="space-y-3">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">Ahmed Bennani</span>
                      <span className="text-xs text-gray-500">Il y a 2 heures</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Inspection visuelle effectuée. Vibrations confirmées au niveau du palier côté accouplement.
                      Recommandation: Remplacement du roulement lors du prochain arrêt mineur.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-900">Système IA</span>
                      <span className="text-xs text-blue-500">Il y a 1 jour</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Analyse prédictive: Probabilité de défaillance dans les 30 jours: 78%.
                      Recommandation de planification urgente.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Statut & Priorité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                <Badge variant={getStatusVariant(anomaly.status)}>
                  {statusOptions.find(s => s.value === anomaly.status)?.label}
                </Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priorité</label>
                <p className="text-gray-900">Priorité {anomaly.priority || 1}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Heures estimées</label>
                <p className="text-gray-900">{anomaly.estimatedHours || 0}h</p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Chronologie</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Anomalie créée</p>
                    <p className="text-xs text-gray-500">{formatDateTime(anomaly.createdAt)}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Analyse IA effectuée</p>
                    <p className="text-xs text-gray-500">{formatDateTime(anomaly.createdAt)}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Dernière mise à jour</p>
                    <p className="text-xs text-gray-500">{formatDateTime(anomaly.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Paperclip className="h-5 w-5" />
                <span>Pièces jointes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  <Paperclip className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">inspection_report.pdf</span>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  <Paperclip className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">vibration_analysis.xlsx</span>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  Ajouter un fichier
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};