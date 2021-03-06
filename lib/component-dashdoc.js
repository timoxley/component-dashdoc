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
var wrench = require('wrench')

var BUILD_PATH = 'build'
var PACKAGE_NAME = 'Components.docset'
var PACKAGE_PATH = path.join(BUILD_PATH, PACKAGE_NAME)
var TEMPLATE_PATH = 'template'
var fs = require('fs')

module.exports.build = function build(done) {
  clean(BUILD_PATH)
  copy(TEMPLATE_PATH, PACKAGE_PATH)
  getComponents(function(err, components) {
    if (err) return done(err)
    getDocs(components, function(err, components) {
      if (err) return done(err)
      writeDocs(components, function(err) {
        if (err) return done(err)
        writeDocset(buildDocset(components), function(err, docset) {
          if (err) return done(err)
          console.info('Done!')
          console.info('now run: /Applications/Xcode.app/Contents/Developer/usr/bin/docsetutil index ' + PACKAGE_PATH)
          done()
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
  if (!process.env.USER || !process.env.PASS) return fn(new Error('github credentials required as env vars USER & PASS.'))
  var url = 'https://api.github.com/repos/' + pkg + '/readme';
  console.info('Getting documentation for %s...', pkg)
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
    fs.writeFile(filename, template(pkg.repo, markdown(readme)), function(err) {
      if (err) return fn(err)
      fn(null, pkg)
    })
  })
}

function template(title, readme) {
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<title>'+title+'</title>',
    '<meta charset="utf-8">',
    '<link rel="stylesheet" type="text/css" href="../../../style.css">',
    '</head>',
    '<body id="readme">',
    '<article class="markdown-body entry-content" itemprop="mainContentOfPage">',
    readme,
    '</article>',
    '</body>',
    '</html>',
  ].join('\r\n')
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
  // replace forward slash with division slash, as can't escape / in identifier url,
  // and this looks pretty damn close
  var identifier = pkg.repo.replace('/', '∕')
  return [
  '  <File path="'+pkg.repo+'/index.html">',
  '    <Token>',
  '        <TokenIdentifier>//apple_ref/cpp/cl/'+identifier+'</TokenIdentifier>',
  '        </Token>',
  '  </File>'].join('\r\n')
}
