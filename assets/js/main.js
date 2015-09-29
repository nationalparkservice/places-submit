/* globals $, authComplete, geojson2osm, L, osmAuth */

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
  var editName;
  var iframe;
  var map;
  var marker;
  var name;
  var type;
  var zoom;

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
  function del (callback) {}
  function submit (callback) {
    var geojson = marker.toGeoJSON();

    geojson.properties.name = name;
    geojson.properties['nps:preset'] = type;
    console.log(geojson);
    /*
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
          data: geojson2osm(geojson, authResult, iD.data.presets.presets, editId),
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
    */
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
        auth.authenticate(callback);
      } else {
        callback();
      }
    });
  }

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
      } else if (name === 'edit_n') {
        editName = decodeURIComponent(param[1]);
      } else if (name === 'iframe') {
        iframe = param[1];
      } else if (name === 'type') {
        type = decodeURIComponent(param[1]);
      } else if (name === 'zoom') {
        zoom = parseInt(param[1], 10);
      }
    }
  });
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
        $('body .delete-backdrop').remove();
      })
      .on('shown.bs.popover', function () {
        $('body').append('<div class="delete-backdrop in modal-backdrop" style="z-index:1059;"></div>');
        $('confirm-delete .btn-danger').click(function () {
          $btn.popover('destroy');
          $('#loading').show();
          $('#loading .progress-bar').show();
          verifyAuth(function () {
            del(function () {
              // TODO: If success, postMessage
            });
          });
        });
        $('.pi-confirm-delete .btn-default').click(function () {
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
        // TODO: Show loading.
        saving = true;
        $name.prev().css('color', '#464646');
        verifyAuth(function () {
          submit(function (result) {
            $(result.upload.result.childNodes[0].innerHTML).each(function (i, el) {
              var places_id;

              if (el.attributes['new_id']) {
                places_id = 'n' + el.attributes['new_id'].value;
              }

              // TODO: Hide loading.

              if (places_id) {
                window.alert(places_id);
              } else {
                window.alert('error!');
              }

              saving = false;
            });
          });
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
    hooks: {
      init: function (callback) {
        map = NPMap.config.L;

        if (dev) {
          $('.leaflet-control-attribution')[0].innerHTML += ' | <span style="color:#d9534f;">DEV</span>';
        }

        if (editId && editLatLng && editName) {
          $drop.hide();
          marker = new L.Marker(editLatLng, {
            draggable: true,
            icon: L.npmap.icon.maki({
              'marker-color': '#d95f02'
            })
          }).addTo(map);
          name = editName;
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
