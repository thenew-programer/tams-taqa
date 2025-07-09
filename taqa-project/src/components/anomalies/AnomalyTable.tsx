import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Download, 
  Eye, 
  Edit, 
  Archive,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Anomaly } from '../../types';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface AnomalyTableProps {
  anomalies: Anomaly[];
  onEdit?: (anomaly: Anomaly) => void;
  onDelete?: (anomaly: Anomaly) => void;
  onArchive?: (anomaly: Anomaly) => void;
  onRestore?: (anomaly: Anomaly) => void;
  isArchive?: boolean;
}

export const AnomalyTable: React.FC<AnomalyTableProps> = ({ 
  anomalies, 
  onEdit, 
  onDelete,
  onArchive,
  onRestore,
  isArchive = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof Anomaly>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'new', label: 'Nouveau' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'treated', label: 'Traité' },
    { value: 'closed', label: 'Fermé' },
  ];
  
  // Dynamic service options based on actual data
  const uniqueServices = [...new Set(anomalies.map(a => a.service).filter(Boolean))];
  const serviceOptions = [
    { value: 'all', label: 'Tous les services' },
    ...uniqueServices.map(service => ({ value: service, label: service }))
  ];

  const criticalityOptions = [
    { value: 'all', label: 'Toutes les criticités' },
    { value: 'low', label: 'Faible' },
    { value: 'medium', label: 'Normale' },
    { value: 'high', label: 'Élevée' },
    { value: 'critical', label: 'Critique' },
  ];
  
  // Calculate criticality level based on sum of scores
  const calculateCriticalityLevel = (anomaly: Anomaly): 'low' | 'medium' | 'high' | 'critical' => {
    const fiabiliteIntegriteScore = anomaly.userFiabiliteIntegriteScore ?? anomaly.fiabiliteIntegriteScore ?? 0;
    const disponibiliteScore = anomaly.userDisponibiliteScore ?? anomaly.disponibiliteScore ?? 0;
    const processSafetyScore = anomaly.userProcessSafetyScore ?? anomaly.processSafetyScore ?? 0;
    
    const totalScore = fiabiliteIntegriteScore + disponibiliteScore + processSafetyScore;
    
    if (totalScore > 9) return 'critical';   // > 9: Anomalies critiques
    if (totalScore >= 7) return 'high';     // 7-8: Anomalies à criticité élevée
    if (totalScore >= 3) return 'medium';   // 3-6: Anomalies à criticité normale
    return 'low';                           // 0-2: Anomalies à criticité faible
  };

  const getBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'new': return 'info';
      case 'in_progress': return 'warning';
      case 'treated': return 'success';
      case 'closed': return 'default';
      default: return 'default';
    }
  };
  
  const filteredAnomalies = anomalies.filter(anomaly => {
    const matchesSearch = (anomaly.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (anomaly.equipmentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (anomaly.responsiblePerson || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || anomaly.status === statusFilter;
    const matchesService = serviceFilter === 'all' || anomaly.service === serviceFilter;
    const matchesCriticality = criticalityFilter === 'all' || calculateCriticalityLevel(anomaly) === criticalityFilter;
    
    return matchesSearch && matchesStatus && matchesService && matchesCriticality;
  });
  
  const sortedAnomalies = [...filteredAnomalies].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    // Handle undefined/null values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
    if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedAnomalies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAnomalies = sortedAnomalies.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, serviceFilter, criticalityFilter]);

  const itemsPerPageOptions = [
    { value: '5', label: '5 par page' },
    { value: '10', label: '10 par page' },
    { value: '20', label: '20 par page' },
    { value: '50', label: '50 par page' },
  ];
  
  const handleSort = (field: keyof Anomaly) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };
  
  const handleExport = () => {
    try {
      // Create CSV content
      const headers = [
        'ID',
        'Équipement',
        'Description',
        'Service',
        'Responsable',
        'Statut',
        'Criticité',
        'Fiabilité/Intégrité',
        'Disponibilité',
        'Sécurité',
        'Date Création',
        'Heures Estimées',
        'Priorité'
      ];
      
      const csvContent = [
        headers.join(','),
        ...sortedAnomalies.map(anomaly => [
          anomaly.id,
          anomaly.equipmentId || '',
          `"${(anomaly.description || '').replace(/"/g, '""')}"`,
          anomaly.service || '',
          `"${(anomaly.responsiblePerson || '').replace(/"/g, '""')}"`,
          anomaly.status || '',
          calculateCriticalityLevel(anomaly),
          (anomaly.fiabiliteIntegriteScore || 0).toFixed(1),
          (anomaly.disponibiliteScore || 0).toFixed(1),
          (anomaly.processSafetyScore || 0).toFixed(1),
          formatDate(anomaly.createdAt),
          anomaly.estimatedHours || 0,
          anomaly.priority || 1
        ].join(','))
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `anomalies_export_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export réalisé avec succès');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export');
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex flex-col">
            <CardTitle>Gestion des Anomalies</CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
              <span>
                {filteredAnomalies.length > 0 && (
                  <>Affichage de {startIndex + 1}-{Math.min(endIndex, filteredAnomalies.length)} sur </>
                )}
                {filteredAnomalies.length} anomalie{filteredAnomalies.length !== 1 ? 's' : ''} trouvée{filteredAnomalies.length !== 1 ? 's' : ''} sur {anomalies.length} au total
              </span>
              {(statusFilter !== 'all' || serviceFilter !== 'all' || criticalityFilter !== 'all' || searchTerm) && (
                <span className="text-blue-600 font-medium">
                  Filtres actifs
                </span>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            {(statusFilter !== 'all' || serviceFilter !== 'all' || criticalityFilter !== 'all' || searchTerm) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setStatusFilter('all');
                  setServiceFilter('all');
                  setCriticalityFilter('all');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
              >
                Réinitialiser
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par description, équipement, ou responsable..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[150px]">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select
                options={serviceOptions}
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select
                options={criticalityOptions}
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('equipmentId')}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>Équipement</span>
                    {sortField === 'equipmentId' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </th> */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <span>Criticité</span>
                    <div title="Calculé à partir de la somme des scores: Faible (0-2), Normale (3-6), Élevée (7-8), Critique (>9)">
                      <Info className="w-3 h-3 text-gray-400 cursor-help" />
                    </div>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('createdAt')}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>Date</span>
                    {sortField === 'createdAt' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAnomalies.map((anomaly) => (
                <tr key={anomaly.id} className="hover:bg-gray-50">
                  {/* <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${getCriticalityColor(anomaly.criticalityLevel)}`} />
                      <div className="text-sm font-medium text-gray-900">
                        {anomaly.equipmentId || 'N/A'}
                      </div>
                    </div>
                  </td> */}
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={anomaly.description || 'N/A'}>
                      {anomaly.description || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {anomaly.service || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getBadgeVariant(calculateCriticalityLevel(anomaly))}>
                      {calculateCriticalityLevel(anomaly)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getStatusVariant(anomaly.status || 'new')}>
                      {anomaly.status || 'new'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(anomaly.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Link to={`/anomaly/${anomaly.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      {isArchive ? (
                        <>
                          {onRestore && (
                            <Button variant="ghost" size="sm" onClick={() => onRestore(anomaly)}>
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button variant="ghost" size="sm" onClick={() => onDelete(anomaly)}>
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {onEdit && (
                            <Button variant="ghost" size="sm" onClick={() => onEdit(anomaly)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {onArchive && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => onArchive(anomaly)}
                              disabled={anomaly.status !== 'treated'}
                              title={anomaly.status !== 'treated' ? 'L\'anomalie doit être traitée avant d\'être archivée' : 'Archiver l\'anomalie'}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {paginatedAnomalies.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune anomalie trouvée.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {sortedAnomalies.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Afficher:</span>
                <Select
                  options={itemsPerPageOptions}
                  value={itemsPerPage.toString()}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="text-sm text-gray-700">
                Affichage de {startIndex + 1} à {Math.min(endIndex, sortedAnomalies.length)} sur {sortedAnomalies.length} résultats
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Précédent
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};