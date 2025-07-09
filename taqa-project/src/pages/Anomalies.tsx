import React, { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AnomalyTable } from '../components/anomalies/AnomalyTable';
import { AnomalyModal } from '../components/anomalies/AnomalyModal';
import { ImportModal } from '../components/import/ImportModal';
import { useData } from '../contexts/DataContext';
import { useAnomalyLogging } from '../hooks/useLogging';
import { Anomaly } from '../types';
import toast from 'react-hot-toast';

export const Anomalies: React.FC = () => {
  const { anomalies, addAnomaly, updateAnomaly, archiveAnomaly } = useData();
  const { 
    logAnomalyCreated, 
    logAnomalyUpdated, 
    logError 
  } = useAnomalyLogging();
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingAnomaly, setEditingAnomaly] = useState<Anomaly | undefined>();
  
  const handleEdit = (anomaly: Anomaly) => {
    setEditingAnomaly(anomaly);
    setShowModal(true);
  };
  
  const handleArchive = async (anomaly: Anomaly) => {
    if (anomaly.status !== 'treated') {
      toast.error('L\'anomalie doit être traitée avant d\'être archivée');
      return;
    }
    
    if (window.confirm('Êtes-vous sûr de vouloir archiver cette anomalie ?')) {
      try {
        const success = await archiveAnomaly(
          anomaly.id,
          'User', // or get from auth context
          'Archivage manuel depuis la liste des anomalies'
        );
        
        if (!success) {
          toast.error('Erreur lors de l\'archivage de l\'anomalie');
        }
      } catch (error) {
        await logError(error as Error, 'anomaly-archive');
        toast.error('Erreur lors de l\'archivage de l\'anomalie');
      }
    }
  };

  const handleCreateNew = () => {
    setEditingAnomaly(undefined);
    setShowModal(true);
  };

  const handleSaveAnomaly = async (anomalyData: Omit<Anomaly, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingAnomaly) {
        // Update existing anomaly
        const oldData = { ...editingAnomaly };
        updateAnomaly(editingAnomaly.id, anomalyData);
        
        // Log the update
        await logAnomalyUpdated(editingAnomaly.id, oldData, anomalyData);
        
        toast.success('Anomalie mise à jour avec succès');
      } else {
        // Create new anomaly
        addAnomaly(anomalyData);
        
        // Log the creation (we'll need to get the new ID from the context)
        const newAnomalyId = `anomaly-${Date.now()}`;
        await logAnomalyCreated(newAnomalyId, anomalyData);
        
        toast.success('Nouvelle anomalie créée avec succès');
      }
      setShowModal(false);
    } catch (error) {
      await logError(error as Error, 'anomaly-save');
      toast.error('Erreur lors de la sauvegarde de l\'anomalie');
    }
  };

  const handleImport = (files: File[]) => {
    console.log('Import files:', files);
    setShowImportModal(false);
    toast.success(`Import réalisé: ${files.length} fichier(s) traité(s)`);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Anomalies</h1>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Anomalie
          </Button>
        </div>
      </div>
      
      <AnomalyTable 
        anomalies={anomalies}
        onEdit={handleEdit}
        onArchive={handleArchive}
      />
      
      <AnomalyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveAnomaly}
        editAnomaly={editingAnomaly}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
    </div>
  );
};