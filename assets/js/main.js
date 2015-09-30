/* globals $, authComplete, geojson2osm, L, osmAuth */

// TODO: Loading bar should update for three different phases of submit.

var iD = {
  data: {}
};
var NPMap;

$(document).ready(function () {
  var $buttons = $('#buttons');
  var $cancel = $('#cancel');
  var $del = $('#delete');
  var $drop = $('#drop');
  var $submit = $('#submit');
  var dev = false;
  var s = document.createElement('script');
  var saving = false;
  var $name;
  var auth;
  var center;
  var editId;
  var editLatLng;
  var iframe;
  var map;
  var marker;
  var name;
  var type;
  var unitCode;
  var zoom;

  $.each(window.location.search.replace('?', '').split('&'), function (i, param) {
    param = param.split('=');

    if (param) {
      var name = param[0];

      if (name === 'center') {
        center = param[1].split(',');
        center = {
          lat: center[0],
          lng: center[1]
        };
      } else if (name === 'dev') {
        if (param[1] && (param[1].toLowerCase() === 'true')) {
          dev = true;
        }
      } else if (name === 'edit_id') {
        editId = param[1];
      } else if (name === 'edit_ll') {
        editLatLng = param[1].split(',');
        editLatLng = {
          lat: parseFloat(editLatLng[0]),
          lng: parseFloat(editLatLng[1])
        };
      } else if (name === 'iframe') {
        iframe = param[1];
      } else if (name === 'name') {
        name = param[1];
      } else if (name === 'type') {
        type = decodeURIComponent(param[1]);
      } else if (name === 'unit_code') {
        unitCode = param[1];
      } else if (name === 'zoom') {
        zoom = parseInt(param[1], 10);
      }
    }
  });

  if (!type || !unitCode) {
    document.body.innerHTML = '<p>You must pass "type" and "unit_code" in as URL parameters.</p>';
  }

  function buildPopup (e) {
    e = e || this;
    e.target.openPopup();
    generateForm();

    if (name) {
      $name.val(name);
    }

    $name.focus();
  }
  function generateForm () {
    $name = $('#name');
    $name
      .val(name)
      .focus()
      .on('input', function () {
        name = $(this).val();

        if (name && name.length) {
          $name.prev().css('color', '#464646');
        }
      });
  }
  function hideLoading () {
    $('#backdrop').hide();
    $('#loading').hide();
  }
  function showLoading () {
    $('#backdrop').show();
    $('#loading').show();
  }
  function submit (callback, edit, del) {
    var geojson = marker.toGeoJSON();

    if (edit) {
      edit = edit.replace('n', '');
    }

    if (name) {
      geojson.properties.name = name;
    }

    console.log(edit);
    console.log(del);

    geojson.properties['nps:preset'] = type;
    geojson.properties['nps:source_system'] = 'Places Submit';
    geojson.properties['nps:unit_code'] = unitCode;
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
      if (authError) {
        callback({
          error: 'Authorization error.',
          success: false
        });
      } else if (authResult) {
        var data = geojson2osm(geojson, authResult, iD.data.npmapPresets.presets, edit, del);
        var id = authResult;

        auth.xhr({
          content: data,
          method: 'POST',
          options: {
            header: {
              'Content-Type': 'text/xml'
            }
          },
          path: '/api/0.6/changeset/' + id + '/upload'
        }, function (uploadDataError, uploadDataResult) {
          if (uploadDataError) {
            callback({
              error: 'Upload error.',
              success: false
            });
          } else {
            auth.xhr({
              method: 'PUT',
              path: '/api/0.6/changeset/' + id + '/close'
            }, function (closeChangesetError, closeChangesetResult) {
              if (closeChangesetError) {
                callback({
                  error: 'Close changeset error.',
                  success: false
                });
              } else {
                callback({
                  auth: {
                    error: authError,
                    result: authResult
                  },
                  close: {
                    error: closeChangesetError,
                    result: closeChangesetResult
                  },
                  success: true,
                  upload: {
                    error: uploadDataError,
                    result: uploadDataResult
                  }
                });
              }
            });
          }
        });
      } else {
        callback({
          error: 'No authorization result.',
          success: false
        });
      }
    });
  }
  function toSecondEditStep (message) {
    var popup = L.popup({
      autoPanPaddingBottomRight: L.point(10, 116),
      autoPanPaddingTopLeft: L.point(48, 48),
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
        '</form>' +
      '');

    message = message || 'Now drag the marker to refine its location, add a name, then click "Submit" to save it to Places.';
    marker
      .bindPopup(popup)
      .openPopup()
      .on('click', buildPopup)
      .on('dragend', buildPopup);
    generateForm();
    $('#buttons p').html(message);
    $drop.hide();
    $submit.show();
  }
  function verifyAuth (callback) {
    auth.xhr({
      method: 'GET',
      path: '/api/0.6/user/details'
    }, function (error, response) {
      if (error) {
        auth.authenticate(callback, true);
      } else {
        callback();
      }
    });
  }

  $del.click(function () {
    var $btn = $(this);

    $btn
      .popover({
        animation: false,
        container: 'body',
        content: '' +
          '<div class="confirm-delete">' +
            '<p>Are you sure you want to delete <em>"' + name + '"</em>?</p>' +
            '<div style="text-align:center;">' +
              '<button class="btn btn-default" style="margin-right:5px;" type="button">Cancel</button>' +
              '<button class="btn btn-danger" type="button">Confirm</button>' +
            '</div>' +
          '</div>' +
        '',
        html: true,
        placement: 'top',
        trigger: 'manual'
      })
      .on('hidden.bs.popover', function () {
        $('#backdrop')
          .css('z-index', '1040')
          .hide();
      })
      .on('shown.bs.popover', function () {
        $('#backdrop')
          .css('z-index', '1059')
          .show();
        $('.confirm-delete .btn-danger').click(function () {
          $btn.popover('destroy');
          showLoading();
          verifyAuth(function () {
            submit(function (result) {
              if (result.success) {
                if (iframe) {
                  window.parent.window.postMessage('delete:' + editId, '*');
                } else {
                  map.success('Node: ' + editId + ' deleted!');
                  map.removeLayer(marker);
                  $buttons.remove();
                }
              } else {
                map.notify.danger('The node could not be deleted. Please try again.');
              }
            }, editId, true);
          });
        });
        $('.confirm-delete .btn-default').click(function () {
          $btn.popover('destroy');
        });
      });
    $btn.popover('show');
  });
  $drop.on('click', function () {
    marker = new L.Marker(map.getCenter(), {
      draggable: true,
      icon: L.npmap.icon.maki({
        'marker-color': '#d95f02'
      })
    }).addTo(map);
    toSecondEditStep();
  });
  $submit.on('click', function () {
    if (!saving) {
      if (!name || !name.length) {
        $name.prev().css('color', '#a94442');
      } else {
        showLoading();
        saving = true;
        $name.prev().css('color', '#464646');
        verifyAuth(function () {
          submit(function (result) {
            if (result.success && result.upload && result.upload.result && result.upload.result.childNodes && result.upload.result.childNodes[0]) {
              $(result.upload.result.childNodes[0].innerHTML).each(function (i, el) {
                if (el.attributes['new_id']) {
                  var latLng = marker.getLatLng();
                  var obj = {
                    n: name,
                    t: type,
                    x: latLng.lng,
                    y: latLng.lat
                  };

                  obj.i = 'n' + el.attributes['new_id'].value;

                  if (editId) {
                    if (iframe) {
                      window.parent.window.postMessage('update:' + JSON.stringify(obj), '*');
                    } else {
                      map.notify.success('Node: ' + editId + ' updated!');
                    }
                  } else {
                    if (iframe) {
                      window.parent.window.postMessage('create:' + JSON.stringify(obj), '*');
                    } else {
                      editId = obj.i;
                      $del.show();
                      map.notify.success('Node: ' + editId + ' created!');
                    }
                  }
                } else {
                  map.notify.danger('No places_id was returned. Please try again.');
                }

                hideLoading();
                saving = false;
              });
            } else {
              map.notify.danger('The submit failed. Please try again.');
            }

            saving = false;
          }, editId);
        });
      }
    }

    return false;
  });
  auth = osmAuth({
    modal: true,
    oauth_consumer_key: 'F7zPYlVCqE2BUH9Hr4SsWZSOnrKjpug1EgqkbsSb',
    oauth_secret: 'rIkjpPcBNkMQxrqzcOvOC4RRuYupYr7k8mfP13H5',
    url: 'http://10.147.153.193' + (dev ? ':8000' : '')
  });

  if (iframe) {
    $cancel.on('click', function () {
      window.parent.window.postMessage('cancel', '*');
    });
  } else {
    $cancel.remove();
  }

  NPMap = {
    baseLayers: [
      'nps-parkTilesImagery'
    ],
    center: center,
    closePopupOnClick: false,
    div: 'map',
    geocoderControl: true,
    hashControl: (iframe ? undefined : true),
    hooks: {
      init: function (callback) {
        map = NPMap.config.L;

        if (dev) {
          $('.leaflet-control-attribution')[0].innerHTML += ' | <span style="color:#d9534f;">DEV</span>';
        }

        if (editId && editLatLng) {
          $drop.hide();
          marker = new L.Marker(editLatLng, {
            draggable: true,
            icon: L.npmap.icon.maki({
              'marker-color': '#d95f02'
            })
          }).addTo(map);
          map.setView(editLatLng, 18);
          toSecondEditStep();
        } else {
          $del.hide();
          $submit.hide();
        }

        $buttons.show();
        L.npmap.util._.appendJsFile('https://nationalparkservice.github.io/places-data/npmapPresets.js');
        callback();
      }
    },
    scrollWheelZoom: (iframe ? undefined : true),
    zoom: zoom
  };
  window.addEventListener('message', function receiveMessage (e) {
    if (e.origin !== 'http://insidemaps.nps.gov') {
      return;
    } else {
      authComplete(e.data);
    }
  }, false);
  s.src = 'http://www.nps.gov/lib/npmap.js/2.0.1/npmap-bootstrap.min.js';
  document.body.appendChild(s);
});
