'use strict';

require('angular/angular');

window.L = require('leaflet');
require('mapbox.js');

var featureToMapObj = require('./featureToMapObjService');

/*
 * Feature edit controller
 */

exports.FeatureEditCtrl = [
	'$scope',
	'$rootScope',
	'Feature',
	'Layer',
	'MessageService',
	'GeocodeService',
	'MapService',
	function($scope, $rootScope, Feature, Layer, Message, Geocode, MapService) {

		var layer;

		$scope.$layer = Layer;

		$scope.$watch('$layer.edit()', function(editing) {
			layer = editing;
			var map = MapService.get();
			if(map)
				map.on('click', addMarkerOnClick);
		});

		$scope.$feature = Feature;

		$scope.$watch('$feature.get()', function(features) {
			$scope.features = features;
		});

		$scope.$watch('$feature.edit()', function(editing) {
			$scope.tool = false;
			$scope.marker = false;
			$scope._data = {};
			$scope.editing = editing;
			$scope.setMarker();
			$rootScope.$broadcast('editFeature');
		});

		$scope._data = {};

		$scope.marker = false;

		$scope.defaults = {
			scrollWheelZoom: false
		};

		var addMarkerOnClick = function(LatLng) {

			var LatLng = LatLng.latlng;

			if(!$scope.marker) {
				$scope.editing.geometry = {
					coordinates: [
						LatLng.lat,
						LatLng.lng
					]
				};
				$scope.setMarker(false);
			}

		}

		$scope.setMarker = function(focus) {

			if($scope.editing) {

				MapService.clearMarkers();

				if($scope.editing.geometry) {

					$scope.marker = featureToMapObj($scope.editing, {
						draggable: true
					});

					$scope.marker
						.bindPopup('<p class="tip">Arraste para alterar a localização.</p>')
						.on('dragstart', function() {
							$scope.marker.closePopup();
						})
						.on('drag', function() {
							$scope.marker.closePopup();
							var coordinates = $scope.marker.getLatLng();
							$scope.editing.geometry.coordinates = [
								coordinates.lat,
								coordinates.lng
							];
						});

					MapService.addMarker($scope.marker);

					$scope.marker.openPopup();

					if(focus !== false) {
						var map = MapService.get();
						map.setView($scope.marker.getLatLng(), 15, {
							reset: true
						});
					}

				} else {

					MapService.fitWorld();

				}

				setTimeout(function() {
					window.dispatchEvent(new Event('resize'));
				}, 200);

			}

		}

		$scope.save = function(silent) {

			if($scope.editing && $scope.editing._id) {

				Feature.resource.update({featureId: $scope.editing._id, layerId: layer._id}, $scope.editing, function(feature) {

					// Replace feature in local features
					angular.forEach($scope.features, function(feature, i) {
						if(feature._id == $scope.editing._id)
							$scope.features[i] = $scope.editing;
					});
					Feature.set($scope.features);

					Feature.edit(angular.copy($scope.editing));

					if(silent !== true) {
						Message.message({
							status: 'ok',
							text: 'Feature salva.'
						});
						$scope.close();
					}

				}, function(err) {

					if(err.status == 500)
						Message.message({
							status: 'error',
							text: 'Ocorreu um erro interno. Tente novamente ou entre em contato com nossa equipe'
						}, false);

				});

			} else {

				var feature = new Feature.resource($scope.editing);

				feature.$save({layerId: layer._id}, function(feature) {

					// Locally push new feature
					$scope.features.push(feature);
					Feature.set($scope.features);

					// Update editing feature to saved data
					Feature.edit(angular.copy(feature));

					Message.message({
						status: 'ok',
						text: 'Feature adicionada.'
					});

				}, function(err) {

					var message = {status: 'error'};

					if(err.status == 400 && err.data.message) {
						message.text = err.data.message;
					} else {
						message.text = 'Ocorreu um erro interno.';
					}

					Message.message(message, false);

				});

			}

		}

		$scope.delete = function() {

			if(confirm('Você tem certeza que deseja remover esta feature?')) {

				Feature.resource.delete({featureId: $scope.editing._id, layerId: layer._id}, function() {

					Feature.set($scope.features.filter(function(f) {
						return f._id !== $scope.editing._id;
					}));
					Feature.edit(false);

					Message.message({
						status: 'ok',
						text: 'Feature removida.'
					});

				}, function(err) {

					var message = {status: 'error'};

					if(err.status == 400 && err.data.message) {
						message.text = err.data.message;
					} else {
						message.text = 'Ocorreu um erro interno.';
					}

					Message.message(message, false);
				});

			}

		}

		/*
		 * Tools
		 */

		$scope.tool = false;

		$scope.setTool = function(tool) {
			if(tool == $scope.tool)
				$scope.tool = false;
			else
				$scope.tool = tool;
		}

		$scope.geocode = function() {

			Geocode.get($scope._data.geocode)
				.success(function(res) {
					$scope._data.geocodeResults = res;
				})
				.error(function(err) {
					$scope._data.geocodeResults = [];
				});

		}

		$scope.setNominatimFeature = function(feature) {

			$scope.editing.geometry = {};

			$scope.editing.geometry.coordinates = [
				parseFloat(feature.lat),
				parseFloat(feature.lon)
			];

			$scope.setMarker();

		}

		$scope.close = function() {

			$scope.tool = false;
			$scope.marker = false;
			$scope._data = {};
			Feature.edit(false);
			$rootScope.$broadcast('closedFeature');

		}

		$scope.$on('layerObjectChange', $scope.close);
		$scope.$on('$stateChangeStart', $scope.close);
		$scope.$on('layer.saved.success', function() {

			if($scope.editing) {
				$scope.save(true);
			}

		});

	}
];