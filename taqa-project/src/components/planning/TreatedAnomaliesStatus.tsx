import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { Anomaly, MaintenanceWindow } from '../../types';

interface TreatedAnomaliesStatusProps {
  anomalies: Anomaly[];
  maintenanceWindows: MaintenanceWindow[];
  onAutoAssign: () => void;
  onCreateWindow: () => void;
}

export const TreatedAnomaliesStatus: React.FC<TreatedAnomaliesStatusProps> = ({
  anomalies,
  maintenanceWindows,
  onAutoAssign,
  onCreateWindow
}) => {
  // Find treated anomalies not yet assigned to maintenance windows
  const treatedUnassigned = anomalies.filter(a => 
    a.status === 'treated' && !a.maintenanceWindowId
  );

  // Find treated anomalies already assigned
  const treatedAssigned = anomalies.filter(a => 
    a.status === 'treated' && a.maintenanceWindowId
  );

  // Count open maintenance windows
  const openWindows = maintenanceWindows.filter(w => 
    w.status === 'planned' || w.status === 'in_progress'
  ).length;

  // Group unassigned by criticality
  const criticalUnassigned = treatedUnassigned.filter(a => a.criticalityLevel === 'critical');
  const highUnassigned = treatedUnassigned.filter(a => a.criticalityLevel === 'high');
  const mediumLowUnassigned = treatedUnassigned.filter(a => 
    ['medium', 'low'].includes(a.criticalityLevel)
  );

  if (treatedUnassigned.length === 0 && treatedAssigned.length === 0) {
    return null; // No treated anomalies to show
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Anomalies Traitées - Statut Planning</span>
          </div>
          <div className="flex space-x-2">
            {treatedUnassigned.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={onAutoAssign}>
                  <Zap className="h-4 w-4 mr-2" />
                  Assigner Automatiquement
                </Button>
                {openWindows === 0 && (
                  <Button variant="outline" size="sm" onClick={onCreateWindow}>
                    <Clock className="h-4 w-4 mr-2" />
                    Créer Fenêtres
                  </Button>
                )}
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Assigned Anomalies */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-800">Assignées</h3>
              <Badge variant="success">{treatedAssigned.length}</Badge>
            </div>
            <p className="text-sm text-green-600">
              Anomalies traitées déjà planifiées dans des fenêtres de maintenance
            </p>
          </div>

          {/* Critical Unassigned */}
          {criticalUnassigned.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-red-800">Critiques Non Assignées</h3>
                <Badge variant="danger">{criticalUnassigned.length}</Badge>
              </div>
              <p className="text-sm text-red-600">
                Nécessitent un arrêt forcé immédiat
              </p>
              <div className="mt-2">
                {criticalUnassigned.slice(0, 2).map(anomaly => (
                  <div key={anomaly.id} className="text-xs bg-white p-1 rounded mb-1">
                    {anomaly.equipmentId} - {anomaly.title.substring(0, 30)}...
                  </div>
                ))}
                {criticalUnassigned.length > 2 && (
                  <div className="text-xs text-red-500">
                    +{criticalUnassigned.length - 2} autres
                  </div>
                )}
              </div>
            </div>
          )}

          {/* High Priority Unassigned */}
          {highUnassigned.length > 0 && (
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-orange-800">Haute Priorité</h3>
                <Badge variant="warning">{highUnassigned.length}</Badge>
              </div>
              <p className="text-sm text-orange-600">
                À planifier dans un arrêt mineur
              </p>
            </div>
          )}

          {/* Medium/Low Priority Unassigned */}
          {mediumLowUnassigned.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-yellow-800">Normale/Faible</h3>
                <Badge variant="info">{mediumLowUnassigned.length}</Badge>
              </div>
              <p className="text-sm text-yellow-600">
                Peuvent attendre le prochain arrêt planifié
              </p>
            </div>
          )}
        </div>

        {/* Status Summary */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="font-semibold text-blue-800">Fenêtres ouvertes:</span>
                <span className="ml-1 text-blue-600">{openWindows}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-blue-800">En attente d'assignation:</span>
                <span className="ml-1 text-blue-600">{treatedUnassigned.length}</span>
              </div>
            </div>
            {treatedUnassigned.length > 0 && openWindows === 0 && (
              <div className="flex items-center text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Aucune fenêtre ouverte disponible
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TreatedAnomaliesStatus;
