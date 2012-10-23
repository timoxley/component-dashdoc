// get all components
// grab all docs
// make tokens
// build docset

var fs = require('fs')
var component = require('component')
var request = require('superagent')
var async = require('async')
var path = require('path')
var markdown = require('markitup').md_to_html
var assert = require('assert')
var mkdirp = require('mkdirp')
var wrench = require('wrench')

var BUILD_PATH = 'build'
var PACKAGE_NAME = 'Components.docset'
var PACKAGE_PATH = path.join(BUILD_PATH, PACKAGE_NAME)
var TEMPLATE_PATH = 'template'
var fs = require('fs')

module.exports.build = function build() {
  clean(BUILD_PATH)
  copy(TEMPLATE_PATH, PACKAGE_PATH)
  getComponents(function(err, components) {
    assert.ifError(err)
    getDocs(components, function(err, components) {
      assert.ifError(err)
      writeDocs(components, function(err) {
        assert.ifError(err)
        writeDocset(buildDocset(components), function(err, docset) {
          assert.ifError(err)
          console.info('Done!')
          console.info('now run: /Applications/Xcode.app/Contents/Developer/usr/bin/docsetutil index ' + PACKAGE_PATH)
        })
      })
    })
  })
}

function clean(dir) {
  wrench.rmdirSyncRecursive(dir, true)
}

function copy(src, dest) {
  mkdirp.sync(dest)
  wrench.copyDirSyncRecursive(src, dest)
}

function getComponents(fn) {
  component.search('', function(err, components) {
    if (err) return fn(err)
    async.filter(components, function(pkg, next) {
      next(pkg && pkg.repo)
    }, fn.bind({}, null))
  })
}

function componentDocs(pkg, fn){
  var url = 'https://api.github.com/repos/' + pkg + '/readme';
  request
  .get(url)
  .auth(process.env.USER, process.env.PASS)
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
      if (!doc) return next(null, null)
      pkg.doc = doc
      next(null, pkg)
    })
  }, function(err, components) {
    if (err) return fn(err)
    async.filter(components, function(pkg, next) {
      next(pkg && pkg.repo)
    }, fn.bind({}, null))
  })
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
  var dir = [PACKAGE_PATH, 'Contents', 'Resources', 'Documents'].concat(pkg.repo.split('/'))
  return path.join.apply(path, dir)
}

function writeDocset(docset, fn) {
  fs.writeFile(path.join(PACKAGE_PATH, 'Contents', 'Resources', 'Tokens.xml'), docset, fn)
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
  return [
  '  <File path="'+pkg.repo+'/index.html">',
  '    <Token><TokenIdentifier>//apple_ref/cpp/cat/'+pkg.repo+'</TokenIdentifier></Token>',
  '  </File>'].join('\r\n')
}
