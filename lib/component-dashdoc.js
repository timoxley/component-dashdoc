// get all components
// grab all docs
// make tokens
// build docset

var fs = require('fs')
var component = require('component')
var request = require('superagent')
var async = require('async')
var path = require('path')
var markdown = require('github-flavored-markdown').parse
var assert = require('assert')
var mkdirp = require('mkdirp')

var PACKAGE_PATH = 'Components.docset/Contents/Resources/Documents/'

var fs = require('fs')
module.exports.build = function build() {
  
    getComponents(function(err, components) {
      assert.ifError(err)
      getDocs(components, function(err, components) {
        assert.ifError(err)
        writeDocs(components, function(err) {
          assert.ifError(err)
          writeDocset(buildDocset(components), function(err, docset) {
            assert.ifError(err)
            console.log('done')
          })
        })
      })
    })
 }

//function clean() {
  //rimraf
//}

//function placeTemplate() {
  
//}

function getComponents(fn) {
  component.search('html', fn)
}

function componentDocs(pkg, fn){
  var url = 'https://api.github.com/repos/' + pkg + '/readme';
  request
  .get(url)
  .auth('timoxley', 'sesame=12')
  .end(function(err, res){
    if (err) return fn(err);
    if (!res.ok) return fn();
    fn(null, res.body);
  });
};


function getDocs(components, fn) {
  async.map(components, function(pkg, next) {
    componentDocs(pkg.repo, function(err, doc) {
      if (err) return next(err)
      if (!doc) return next(new Error("failed to lookup docs for " + pkg.name))
      pkg.doc = doc
      next(null, pkg)
    })
  }, fn)
}

function writeDocs(components, fn) {
  async.map(components, function(doc, next) {
    writeDoc(doc, next)
  }, fn)
}

function writeDoc(pkg, fn) {
  assert(pkg.doc)
  var readme = new Buffer(pkg.doc.content, 'base64').toString('utf8')
  mkdirp(dirName(pkg), function(err) {
    if (err) return fn(err)
    var filename = path.join(dirName(pkg), 'index.html')
    pkg.doc.path = filename
    fs.writeFile(filename, markdown(readme), function(err) {
      if (err) return fn(err)
      fn(null, pkg)
    })
  })
}

function dirName(pkg) {
  var dir = [PACKAGE_PATH].concat(pkg.repo.split('/'))
  return path.join.apply(path, dir)
}

function writeDocset(docset, fn) {
  fs.writeFile(path.join(PACKAGE_PATH, 'docset.xml'), docset, fn)
}

function buildDocset(components) {
  return ['<?xml version="1.0" encoding="UTF-8"?>',
  '<Tokens version="1.0">',
    components.map(function(pkg) {
      return buildToken(pkg)
    }).join('\r\n'),
  '</Tokens>'].join('\r\n')
}

function buildToken(pkg) {
  var doc = pkg.doc
  return [
  '  <File path="'+doc.path+'">',
  '    <Token><TokenIdentifier>//apple_ref/cpp/cat/'+pkg.repo+'</TokenIdentifier></Token>',
  '  </File>'].join('\r\n')
}
