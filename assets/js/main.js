/* globals $, authComplete, geojson2osm, L, osmAuth */

/*

   - Check against InsideMaps status to see if user is logged in.
   - If they are, show map, etc.
   - If they aren't, redirect them to the InsideMaps login page
   - Pass hash information in so it is captured properly
   - Once they've saved a point, call the function, via postMessage, that is passed in via the URL

*/

var iD = {
  data: {}
};
var NPMap;

$(document).ready(function () {
  var dev = false;
  var iframe = false;
  var s = document.createElement('script');
  var $name;
  var $type;
  var auth;
  var marker;
  var name;
  var type;
  var types;

  function buildPopup (e) {
    e = e || this;
    e.target.openPopup();
    generateForm();

    if (name) {
      $name.val(name);
    }

    $name.focus();
    $type.val(type);
  }
  function generateForm () {
    var interval = setInterval(function () {
      $name = $('#name');

      if (typeof $name === 'object') {
        var saving = false;

        clearInterval(interval);
        $type = $('#type');
        $.each(types, function (i, type) {
          var name = type.name;
          $type.append('<option value="' + name + '">' + name + '</option>');
        });
        $type.on('change', function () {
          type = $(this).val();
        });
        $name
          .focus()
          .on('input', function () {
            name = $(this).val();

            if (name && name.length) {
              $name.prev().css('color', '#464646');
            }
          });
        $('form').submit(function () {
          if (!saving) {
            if (!name || !name.length) {
              $name.prev().css('color', '#a94442');
            } else {
              var div = document.createElement('div');
              var geojson = marker.toGeoJSON();
              var nodeToModifyId = null; // Put the id of the node you'd like to modify here, if this is falsy, it will create a new node
              $name.prev().css('color', '#464646');
              saving = true;
              geojson.properties.name = name;
              geojson.properties['nps:preset'] = type;
              div.className = 'modal-backdrop in';
              div.style.zIndex = '9999';
              document.body.appendChild(div);
              document.getElementById('loading').style.display = 'block';
              $('.wrapper').hide();
              uploadGeojson(geojson, nodeToModifyId, function (uploadResult) {
                $(uploadResult.upload.result.childNodes[0].innerHTML).each(function (i, el) {
                  var places_id;

                  if (el.attributes['new_id']) {
                    places_id = 'n' + el.attributes['new_id'].value;
                  }

                  document.getElementById('loading').style.display = 'none';
                  div.parentNode.removeChild(div);

                  if (places_id) {
                    window.alert(places_id);
                  } else {
                    $('.wrapper').show();
                    window.alert('error!');
                  }

                  saving = false;
                });
              });
            }
          }

          return false;
        });

        if (name) {
          $name.val(name);
        }

        if (type) {
          $type.val(type);
        } else {
          type = $type.val();
        }
      }
    }, 100);
  }
  function uploadGeojson (geojson, nodeToModifyId, callback) {
    auth.xhr({
      content: '<osm><changeset version="0.3" generator="npmap-uploader"><tag k="created_by" v="places-uploader"/><tag k="locale" v="en-US"/><tag k="comment" v="Parking"/></changeset></osm>',
      method: 'PUT',
      options: {
        header: {
          'Content-Type': 'text/xml'
        }
      },
      path: '/api/0.6/changeset/create'
    }, function (authError, authResult) {
      if (!authError && authResult) {
        var changeset = {
          data: geojson2osm(geojson, authResult, iD.data.presets.presets, nodeToModifyId),
          id: authResult
        };
        auth.xhr({
          content: changeset.data,
          method: 'POST',
          options: {
            header: {
              'Content-Type': 'text/xml'
            }
          },
          path: '/api/0.6/changeset/' + changeset.id + '/upload'
        }, function (uploadDataError, uploadDataResult) {
          if (!uploadDataError) {
            auth.xhr({
              method: 'PUT',
              path: '/api/0.6/changeset/' + changeset.id + '/close'
            }, function (closeChangesetError, closeChangesetResult) {
              if (!closeChangesetError) {
                NPMap.config.L.removeLayer(marker);
                callback({
                  auth: {
                    error: authError,
                    result: authResult
                  },
                  upload: {
                    error: uploadDataError,
                    result: uploadDataResult
                  },
                  close: {
                    error: closeChangesetError,
                    result: closeChangesetResult
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  $.each(window.location.search.replace('?', '').split('&'), function (i, param) {
    param = param.split('=');

    if (param) {
      var name = param[0];

      if (name === 'dev') {
        if (param[1] && (param[1].toLowerCase() === 'true')) {
          dev = true;
        }
      } else if (name === 'iframe') {
        if (param[1] && (param[1].toLowerCase() === 'true')) {
          iframe = true;
        }
      }
    }
  });

  auth = osmAuth({
    modal: true,
    oauth_consumer_key: 'F7zPYlVCqE2BUH9Hr4SsWZSOnrKjpug1EgqkbsSb',
    oauth_secret: 'rIkjpPcBNkMQxrqzcOvOC4RRuYupYr7k8mfP13H5',
    url: 'http://10.147.153.193' + (dev ? ':8000' : '')
  });
  auth.xhr({
    method: 'GET',
    path: '/api/0.6/user/details'
  }, function (error, response) {
    if (error) {
      auth.authenticate(function () {});
    }
  });
  NPMap = {
    baseLayers: [
      'nps-parkTilesImagery'
    ],
    closePopupOnClick: false,
    div: 'map',
    draggable: true,
    // TODO: Differentiate between click and dblclick.
    events: [{
      fn: function (e) {
        if (!marker) {
          var popup = L.popup({
            autoPanPadding: L.point(65, 65),
            closeButton: false,
            closeOnClick: false,
            keepInView: true
          })
            .setContent('' +
              '<form>' +
                '<div class="form-group">' +
                  '<label for="name">Name</label>' +
                  '<input class="form-control" id="name" type="text">' +
                '</div>' +
                '<div class="form-group">' +
                  '<label for="type=">Type</label>' +
                  '<select class="form-control" id="type">' +
                  '</select>' +
                '</div>' +
                '<div style="text-align:center;">' +
                  '<button class="btn btn-primary">Submit</button>' +
                '</div>' +
              '</form>' +
            '');

          document.getElementsByClassName('panel-body')[0].childNodes[0].innerHTML = 'Drag the marker to position it then fill out and submit the form.';
          marker = L.marker(e.latlng, {
            draggable: true
          })
            .addTo(NPMap.config.L)
            .bindPopup(popup)
            .openPopup()
            .on('click', buildPopup)
            .on('dragend', buildPopup);
          generateForm();
        }
      },
      type: 'click'
    }],
    hashControl: true,
    homeControl: false,
    hooks: {
      init: function (callback) {
        var div = document.createElement('div');
        div.className = 'wrapper';
        div.innerHTML = '' +
          '<div class="panel panel-default">' +
            '<div class="panel-body">' +
              '<p>Click the map to add a location.</p>' +
            '</div>' +
          '</div>' +
        '';
        document.getElementsByClassName('npmap-container')[0].appendChild(div);

        if (dev) {
          document.getElementsByClassName('leaflet-control-attribution')[0].innerHTML += ' | <span style="color:#d9534f;">DEV</span>';
        }

        L.npmap.util._.reqwest({
          success: function (response) {
            var points = [];
            var presets = iD.data.presets.presets;

            for (var prop in presets) {
              if (prop.indexOf('nps') > -1) {
                var preset = presets[prop];

                if (preset.geometry.indexOf('point') > -1 && points.indexOf(preset) === -1) {
                  points.push(preset);
                }
              }
            }

            points.sort(function (a, b) {
              return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            types = points;
          },
          url: 'http://nationalparkservice.github.io/places-data/npmapPresets.js'
        });
        callback();
      }
    }
  };
  s.src = 'http://www.nps.gov/lib/npmap.js/2.0.1/npmap-bootstrap.min.js';
  document.body.appendChild(s);
  window.addEventListener('message', function receiveMessage (e) {
    if (e.origin !== 'http://insidemaps.nps.gov') {
      return;
    } else {
      authComplete(e.data);
    }
  }, false);
});
