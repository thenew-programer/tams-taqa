import React, { useState, useEffect } from 'react';
import {
	X,
	Calendar,
	Users,
	AlertTriangle,
	Edit,
	Save,
	BarChart3,
	Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { MaintenanceWindow, Anomaly, ActionPlan } from '../../../types';
import { formatDate } from '../../../lib/utils';

interface WindowDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	window: MaintenanceWindow | null;
	anomalies: Anomaly[];
	actionPlans: ActionPlan[];
	onUpdateWindow: (windowId: string, updates: Partial<MaintenanceWindow>) => void;
	mode: 'view' | 'edit';
	onSwitchMode: (mode: 'view' | 'edit') => void;
}

export const WindowDetailModal: React.FC<WindowDetailModalProps> = ({
	isOpen,
	onClose,
	window,
	anomalies,
	actionPlans,
	onUpdateWindow,
	mode,
	onSwitchMode
}) => {
	const [editData, setEditData] = useState<Partial<MaintenanceWindow>>({});
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (window && mode === 'edit') {
			setEditData({
				type: window.type,
				durationDays: window.durationDays,
				startDate: window.startDate,
				endDate: window.endDate,
				description: window.description,
				status: window.status
			});
		}
	}, [window, mode]);

	if (!isOpen || !window) return null;

	// Get assigned anomalies for this window
	const assignedAnomalies = anomalies.filter(a => a.maintenanceWindowId === window.id);
	const relatedActionPlans = actionPlans.filter(ap =>
		assignedAnomalies.some(anomaly => anomaly.id === ap.anomalyId)
	);

	// Calculate statistics
	const totalEstimatedHours = relatedActionPlans.reduce((sum, plan) =>
		sum + (plan.totalDurationDays * 8), 0); // Assuming 8 hours per day

	const utilization = window.durationDays > 0
		? (totalEstimatedHours / (window.durationDays * 24)) * 100
		: 0;

	const handleSave = async () => {
		if (!window.id) return;

		setIsLoading(true);
		try {
			await onUpdateWindow(window.id, editData);
			onSwitchMode('view');
		} catch (error) {
			console.error('Error updating window:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'planned': return 'bg-blue-100 text-blue-800';
			case 'in_progress': return 'bg-yellow-100 text-yellow-800';
			case 'completed': return 'bg-green-100 text-green-800';
			case 'cancelled': return 'bg-red-100 text-red-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const getTypeColor = (type: string) => {
		switch (type) {
			case 'force': return 'bg-red-100 text-red-800';
			case 'major': return 'bg-blue-100 text-blue-800';
			case 'minor': return 'bg-yellow-100 text-yellow-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const getCriticalityColor = (level: string) => {
		switch (level) {
			case 'critical': return 'bg-red-500 text-white';
			case 'high': return 'bg-orange-500 text-white';
			case 'medium': return 'bg-yellow-500 text-white';
			case 'low': return 'bg-green-500 text-white';
			default: return 'bg-gray-500 text-white';
		}
	};

	return (
		<div
			className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
		>
			<div className="flex items-center justify-center min-h-full p-2 sm:p-4">
				<div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
						<div className="flex items-center gap-3 min-w-0 flex-1">
							<div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
								<Calendar className="h-5 w-5 text-blue-600" />
							</div>
							<div className="min-w-0 flex-1">
								<h2 className="text-xl font-semibold text-gray-900 truncate">
									{mode === 'edit' ? 'Modifier' : 'Détails'} - Fenêtre de Maintenance
								</h2>
								<p className="text-sm text-gray-600 mt-1">
									{mode === 'edit' ? 'Modifiez les paramètres de la fenêtre' : 'Informations détaillées de la fenêtre'}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							{mode === 'view' ? (
								<Button
									variant="outline"
									size="md"
									onClick={() => onSwitchMode('edit')}
									className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300 transition-colors px-4 py-2"
								>
									<Edit className="h-4 w-4" />
									Modifier
								</Button>
							) : (
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="md"
										onClick={() => onSwitchMode('view')}
										disabled={isLoading}
										className="hover:bg-gray-50 transition-colors px-4 py-2"
									>
										Annuler
									</Button>
									<Button
										size="md"
										onClick={handleSave}
										disabled={isLoading}
										className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2"
									>
										{isLoading ? (
											<div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
										) : (
											<Save className="h-4 w-4" />
										)}
										Sauvegarder
									</Button>
								</div>
							)}
							<Button
								variant="ghost"
								size="md"
								onClick={onClose}
								className="hover:bg-red-50 hover:text-red-600 transition-colors h-10 w-10 p-0"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
					</div>

					<div className="p-4 space-y-4 bg-gray-50">
						{/* Progress indicators for edit mode */}
						{mode === 'edit' && (
							<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
								<div className="flex items-center gap-2 text-blue-800">
									<Edit className="h-5 w-5" />
									<span className="font-medium">Mode d'édition activé</span>
								</div>
								<p className="text-sm text-blue-600 mt-1">
									Modifiez les champs souhaités puis cliquez sur "Sauvegarder" pour enregistrer vos changements.
								</p>
							</div>
						)}

						{/* Basic Information */}
						<div className="space-y-4">
							{/* Window Details */}
							<Card className="shadow-sm hover:shadow-md transition-shadow">
								<CardHeader className="pb-2 px-4 py-3">
									<CardTitle className="text-base flex items-center gap-2">
										<Calendar className="h-4 w-4 text-blue-600" />
										Informations de Base
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2 text-sm px-4 pb-3">
									{mode === 'edit' ? (
										<>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Type
												</label>
												<select
													value={editData.type || ''}
													onChange={(e) => setEditData(prev => ({ ...prev, type: e.target.value as any }))}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
												>
													<option value="force">Arrêt Forcé</option>
													<option value="major">Majeur</option>
													<option value="minor">Mineur</option>
												</select>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Durée (jours)
												</label>
												<input
													type="number"
													min="1"
													max="60"
													value={editData.durationDays || ''}
													onChange={(e) => setEditData(prev => ({ ...prev, durationDays: parseInt(e.target.value) }))}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Date de début
												</label>
												<input
													type="datetime-local"
													value={editData.startDate?.toISOString().slice(0, 16) || ''}
													onChange={(e) => setEditData(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Date de fin
												</label>
												<input
													type="datetime-local"
													value={editData.endDate?.toISOString().slice(0, 16) || ''}
													onChange={(e) => setEditData(prev => ({ ...prev, endDate: new Date(e.target.value) }))}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Statut
												</label>
												<select
													value={editData.status || ''}
													onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value as any }))}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
												>
													<option value="planned">Planifié</option>
													<option value="in_progress">En cours</option>
													<option value="completed">Terminé</option>
													<option value="cancelled">Annulé</option>
												</select>
											</div>
										</>
									) : (
										<>
											<div className="flex justify-between">
												<span className="text-sm text-gray-500">Type:</span>
												<Badge className={getTypeColor(window.type)}>{window.type}</Badge>
											</div>
											<div className="flex justify-between">
												<span className="text-sm text-gray-500">Durée:</span>
												<span className="text-sm font-medium">{window.durationDays} jours</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm text-gray-500">Début:</span>
												<span className="text-sm font-medium">{formatDate(window.startDate)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm text-gray-500">Fin:</span>
												<span className="text-sm font-medium">{formatDate(window.endDate)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm text-gray-500">Statut:</span>
												<Badge className={getStatusColor(window.status)}>{window.status}</Badge>
											</div>
										</>
									)}

									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Description
										</label>
										{mode === 'edit' ? (
											<textarea
												value={editData.description || ''}
												onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
												className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
												rows={3}
											/>
										) : (
											<p className="text-sm text-gray-900">{window.description || 'Aucune description'}</p>
										)}
									</div>
								</CardContent>
							</Card>

							{/* Anomaly Dashboard Statistics */}
							<Card className="shadow-sm hover:shadow-md transition-shadow">
								<CardHeader className="pb-4">
									<CardTitle className="text-lg flex items-center gap-2">
										<BarChart3 className="h-5 w-5 text-purple-600" />
										Tableau de Bord des Anomalies
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-6">
									{/* Key Performance Indicators */}
									<div className="grid grid-cols-4 gap-4">
										<div className="bg-blue-50 rounded-lg p-4 text-center">
											<div className="text-2xl font-bold text-blue-900">{assignedAnomalies.length}</div>
											<div className="text-sm font-medium text-blue-700">Total Anomalies</div>
										</div>
										<div className="bg-red-50 rounded-lg p-4 text-center">
											<div className="text-2xl font-bold text-red-900">
												{assignedAnomalies.filter(a => a.criticalityLevel === 'critical').length}
											</div>
											<div className="text-sm font-medium text-red-700">Critiques</div>
										</div>
										<div className="bg-green-50 rounded-lg p-4 text-center">
											<div className="text-2xl font-bold text-green-900">
												{assignedAnomalies.filter(a => a.status === 'treated' || a.status === 'closed').length}
											</div>
											<div className="text-sm font-medium text-green-700">Résolues</div>
										</div>
										<div className="bg-orange-50 rounded-lg p-4 text-center">
											<div className="text-2xl font-bold text-orange-900">
												{assignedAnomalies.filter(a => a.status === 'in_progress').length}
											</div>
											<div className="text-sm font-medium text-orange-700">En Cours</div>
										</div>
									</div>

									{/* Status Distribution */}
									<div className="space-y-3">
										<h4 className="text-base font-medium text-gray-700">Répartition par Statut</h4>
										<div className="space-y-2">
											{['new', 'in_progress', 'treated', 'closed'].map(status => {
												const count = assignedAnomalies.filter(a => a.status === status).length;
												const percentage = assignedAnomalies.length > 0 ? (count / assignedAnomalies.length) * 100 : 0;
												const statusLabels = {
													'new': 'Nouveau',
													'in_progress': 'En cours',
													'treated': 'Traité',
													'closed': 'Fermé'
												};
												const statusColors = {
													'new': 'bg-gray-500',
													'in_progress': 'bg-yellow-500',
													'treated': 'bg-blue-500',
													'closed': 'bg-green-500'
												};

												return (
													<div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
														<div className="flex items-center gap-3">
															<div className={`w-3 h-3 rounded-full ${statusColors[status as keyof typeof statusColors]}`}></div>
															<span className="text-sm font-medium">{statusLabels[status as keyof typeof statusLabels]}</span>
														</div>
														<div className="flex items-center gap-3">
															<span className="text-sm font-bold">{count}</span>
															<div className="w-16 h-2 bg-gray-200 rounded-full">
																<div
																	className={`h-2 rounded-full ${statusColors[status as keyof typeof statusColors]}`}
																	style={{ width: `${percentage}%` }}
																/>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									</div>

									{/* Safety Scores Overview */}
									<div className="space-y-3">
										<h4 className="text-base font-medium text-gray-700">Scores de Sécurité Moyens</h4>
										<div className="grid grid-cols-3 gap-4">
											{[
												{
													label: 'Fiabilité & Intégrité',
													value: assignedAnomalies.length > 0
														? (assignedAnomalies.reduce((sum, a) => sum + (a.useUserScores ? a.userFiabiliteIntegriteScore || a.fiabiliteIntegriteScore : a.fiabiliteIntegriteScore), 0) / assignedAnomalies.length).toFixed(1)
														: '0',
													color: 'bg-blue-500'
												},
												{
													label: 'Disponibilité',
													value: assignedAnomalies.length > 0
														? (assignedAnomalies.reduce((sum, a) => sum + (a.useUserScores ? a.userDisponibiliteScore || a.disponibiliteScore : a.disponibiliteScore), 0) / assignedAnomalies.length).toFixed(1)
														: '0',
													color: 'bg-green-500'
												},
												{
													label: 'Sécurité Process',
													value: assignedAnomalies.length > 0
														? (assignedAnomalies.reduce((sum, a) => sum + (a.useUserScores ? a.userProcessSafetyScore || a.processSafetyScore : a.processSafetyScore), 0) / assignedAnomalies.length).toFixed(1)
														: '0',
													color: 'bg-red-500'
												}
											].map((score, index) => (
												<div key={index} className="bg-white border rounded-lg p-4 text-center">
													<div className="text-2xl font-bold text-gray-900">{score.value}/5</div>
													<div className="text-xs text-gray-600 mt-1">{score.label}</div>
													<div className="w-full h-2 bg-gray-200 rounded-full mt-2">
														<div
															className={`h-2 rounded-full ${score.color}`}
															style={{ width: `${(parseFloat(score.value) / 5) * 100}%` }}
														/>
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Window Efficiency Metrics */}
									<div className="space-y-3">
										<h4 className="text-base font-medium text-gray-700">Efficacité de la Fenêtre</h4>
										<div className="grid grid-cols-2 gap-4">
											<div className="bg-purple-50 rounded-lg p-4">
												<div className="flex items-center justify-between">
													<span className="text-sm font-medium text-purple-700">Temps Estimé Total</span>
													<span className="text-xl font-bold text-purple-900">
														{assignedAnomalies.reduce((sum, a) => sum + (a.estimatedHours || 0), 0)}h
													</span>
												</div>
											</div>
											<div className="bg-indigo-50 rounded-lg p-4">
												<div className="flex items-center justify-between">
													<span className="text-sm font-medium text-indigo-700">Taux d'Occupation</span>
													<span className={`text-xl font-bold ${utilization > 90 ? 'text-red-600' :
														utilization > 70 ? 'text-yellow-600' : 'text-green-600'
														}`}>
														{utilization.toFixed(0)}%
													</span>
												</div>
											</div>
										</div>

										{/* Service Distribution */}
										<div className="mt-4">
											<h5 className="text-sm font-medium text-gray-600 mb-2">Répartition par Service</h5>
											<div className="space-y-1">
												{Array.from(new Set(assignedAnomalies.map(a => a.service))).map(service => {
													const count = assignedAnomalies.filter(a => a.service === service).length;
													const percentage = (count / assignedAnomalies.length) * 100;
													return (
														<div key={service} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
															<span className="font-medium">{service}</span>
															<div className="flex items-center gap-2">
																<span>{count}</span>
																<div className="w-12 h-1.5 bg-gray-200 rounded-full">
																	<div
																		className="h-1.5 bg-blue-500 rounded-full"
																		style={{ width: `${percentage}%` }}
																	/>
																</div>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Assigned Anomalies */}
						<Card className="shadow-sm hover:shadow-md transition-shadow">
							<CardHeader className="pb-2 px-4 py-3">
								<CardTitle className="text-base flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Users className="h-4 w-4 text-orange-600" />
										Anomalies Assignées
									</div>
									<Badge variant="info" className="bg-orange-100 text-orange-800 text-sm px-2 py-1">
										{assignedAnomalies.length}
									</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent className="px-4 pb-3">
								{assignedAnomalies.length === 0 ? (
									<div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg">
										<AlertTriangle className="h-16 w-16 mx-auto mb-6 opacity-30" />
										<p className="font-medium text-xl">Aucune anomalie assignée</p>
										<p className="text-base mt-2">Cette fenêtre de maintenance est disponible pour de nouvelles assignations</p>
									</div>
								) : (
									<div className="space-y-4">
										{assignedAnomalies.map((anomaly, index) => {
											const actionPlan = relatedActionPlans.find(ap => ap.anomalyId === anomaly.id);
											return (
												<div
													key={anomaly.id}
													className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-200 bg-white"
													style={{ animationDelay: `${index * 100}ms` }}
												>
													<div className="flex items-start justify-between">
														<div className="flex-1 min-w-0">
															<div className="flex items-start gap-4">
																<div className="flex-shrink-0">
																	<div className={`w-4 h-4 rounded-full ${getCriticalityColor(anomaly.criticalityLevel).replace('text-white', '').split(' ')[0]} mt-2`} />
																</div>
																<div className="flex-1">
																	<h4 className="font-semibold text-gray-900 mb-2 text-base">
																		{anomaly.title}
																	</h4>
																	<div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
																		<span className="bg-gray-100 px-2 py-1 rounded text-xs">{anomaly.equipmentId}</span>
																		<span>•</span>
																		<span>{anomaly.service}</span>
																	</div>
																	<div className="flex items-center gap-3">
																		<Badge className={getCriticalityColor(anomaly.criticalityLevel)} variant="default">
																			{anomaly.criticalityLevel}
																		</Badge>
																		{actionPlan && (
																			<div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
																				<Clock className="h-3 w-3" />
																				<span>{actionPlan.totalDurationDays} jours</span>
																				<span>•</span>
																				<span>Priorité {actionPlan.priority}</span>
																			</div>
																		)}
																	</div>
																</div>
															</div>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};
