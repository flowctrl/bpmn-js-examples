'use strict';

var fs = require('fs');

var $ = require('jquery'),
    BpmnModeler = require('bpmn-js/lib/Modeler');

var propertiesPanelModule = require('bpmn-js-properties-panel'),
    propertiesProviderModule = require('bpmn-js-properties-panel/lib/provider/camunda'),
    camundaModdleDescriptor = require('camunda-bpmn-moddle/resources/camunda');

var blobUtil = require("blob-util");

var container = $('#js-drop-zone');

var canvas = $('#js-canvas');

var bpmnModeler = new BpmnModeler({
  container: canvas,
  zoomScroll: {
    enabled: (window.pal.consumer != 'hwenc')
  },
  keyboard: {
    bindTo: document
  },
  propertiesPanel: {
    parent: '#js-properties-panel'
  },
  additionalModules: [
    propertiesPanelModule,
    propertiesProviderModule
  ],
  moddleExtensions: {
    camunda: camundaModdleDescriptor
  }
});

var newDiagramXML = fs.readFileSync(__dirname + '/../resources/newDiagram.bpmn', 'utf-8');
var emptyDiagramXML = fs.readFileSync(__dirname + '/../resources/emptyDiagram.bpmn', 'utf-8');

function createNewDiagram() {
  if (window.pal.consumer != 'hwenc') {
    openDiagram(newDiagramXML);
  } else {
    openDiagram(emptyDiagramXML);
  }
}

function openDiagram(xml) {

  bpmnModeler.importXML(xml, function(err) {

    if (err) {
      container
        .removeClass('with-diagram')
        .addClass('with-error');

      container.find('.error pre').text(err.message);

      console.error(err);
    } else {
      container
        .removeClass('with-error')
        .addClass('with-diagram');
    }


  });
}

function saveSVG(done) {
  bpmnModeler.saveSVG(done);
}

function saveDiagram(done) {

  bpmnModeler.saveXML({ format: true }, function(err, xml) {
    done(err, xml);
  });
}

function registerFileDrop(container, callback) {

  function handleFileSelect(e) {
    e.stopPropagation();
    e.preventDefault();

    var files = e.dataTransfer.files;

    var file = files[0];

    var reader = new FileReader();

    reader.onload = function(e) {

      var xml = e.target.result;

      callback(xml);
    };

    reader.readAsText(file);
  }

  function handleDragOver(e) {
    e.stopPropagation();
    e.preventDefault();

    e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  container.get(0).addEventListener('dragover', handleDragOver, false);
  container.get(0).addEventListener('drop', handleFileSelect, false);
}


////// file drag / drop ///////////////////////

// check file api availability
if (!window.FileList || !window.FileReader) {
  window.alert(
    'Looks like you use an older browser that does not support drag and drop. ' +
    'Try using Chrome, Firefox or the Internet Explorer > 10.');
} else {
  registerFileDrop(container, openDiagram);
}

// bootstrap diagram functions

$(document).on('ready', function() {

  var processId = window.pal.process_id;
  var contextPath = window.context_path;
  if (processId === '') {
    createNewDiagram();
  } else {
    $.ajax({
      type : "GET",
      url : contextPath + "/bpmn/" + processId + "/bpmn",
      success : function(xml) {
        openDiagram(xml);
      }
    });
  }
  /*
  $('#js-create-diagram').click(function(e) {
    e.stopPropagation();
    e.preventDefault();

    createNewDiagram();
  });
  */

  var downloadLink = $('#js-download-diagram');
  var downloadSvgLink = $('#js-download-svg');

  $('.buttons a').click(function(e) {
    var $this = $(this);
    if (!$this.is('.active')) {
      e.preventDefault();
      e.stopPropagation();
    }

    // IE >= 10 의 경우 브라우저의 msSaveBlob 를 통해 다운로드
    if ($this.is('.active') && typeof window.navigator.msSaveBlob == 'function') {
      e.preventDefault();
      e.stopPropagation();

      var dataType = 'data:application/bpmn20-xml;charset=UTF-8,';
      var dataURL = dataType + window.btoa(decodeURIComponent($this.attr('href').substring(dataType.length)));
      var download = $this.attr('download');
      blobUtil.dataURLToBlob(dataURL).then(function (blob) {
        window.navigator.msSaveBlob(blob, download);
      }).catch(function (err) {
        window.alert('XML 저장 중 에러 발생 : ' + err);
      });
    }

  });

  function setEncoded(link, name, data) {
    var encodedData = encodeURIComponent(data);

    if (data) {
      link.addClass('active').attr({
        'href': 'data:application/bpmn20-xml;charset=UTF-8,' + encodedData,
        'download': name
      });
    } else {
      link.removeClass('active');
    }
  }

  var debounce = require('lodash/function/debounce');

  var exportArtifacts = debounce(function() {

    saveSVG(function(err, svg) {
      setEncoded(downloadSvgLink, 'diagram.svg', err ? null : window.hackSaveSVG(svg));
    });

    saveDiagram(function(err, xml) {
      setEncoded(downloadLink, 'diagram.bpmn', err ? null : xml);
      if (err) {
        $('#js-server-save').removeClass('active');
      } else {
        $('#js-server-save').addClass('active');
      }
    });
  }, 500);

  bpmnModeler.on('commandStack.changed', exportArtifacts);
});
