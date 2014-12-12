'use strict'

// Foundation for Apps
//
// We use this Gulpfile to assemble the documentation, run unit tests,
// and deploy changes to the live documentation and CDN.
//
// The tasks are grouped into these categories:
//  1. Libraries
//  2. Cleaning files
//  3. Copying files
//  4. Stylesheets
//  5. JavaScript
//  6. Testing
//  7. Server
//  8. Deployment
//  9. Default tasks

// 1. LIBRARIES
// - - - - - - - - - - - - - - -

var gulp           = require('gulp'),
    rimraf         = require('rimraf'),
    runSequence    = require('run-sequence'),
    markdown       = require('gulp-markdown'),
    highlight      = require('gulp-highlight'),
    autoprefixer   = require('gulp-autoprefixer'),
    sass           = require('gulp-ruby-sass'),
    nodeSass       = require('gulp-sass'),
    uglify         = require('gulp-uglify'),
    concat         = require('gulp-concat'),
    connect        = require('gulp-connect'),
    modRewrite     = require('connect-modrewrite'),
    dynamicRouting = require('./bin/gulp-dynamic-routing'),
    karma          = require('gulp-karma'),
    rsync          = require('gulp-rsync'),
    merge          = require('merge-stream');

// 2. CLEANIN'
// - - - - - - - - - - - - - - -

// Clean build directory
gulp.task('clean', function(cb) {
  rimraf('./build', cb);
});

// Clean the partials directory
gulp.task('clean:partials', function(cb) {
  rimraf('./build/partials', cb);
});

// 3. COPYING FILES
// - - - - - - - - - - - - - - -

// Copy static files (but not the Angular templates, Sass, or JS)
gulp.task('copy', function() {
  var dirs = [
    './docs/**/*.*',
    '!./docs/templates/**/*.*',
    '!./docs/assets/{scss,js}/**/*.*'
  ];
  gulp.src(dirs, {
    base: './docs/'
  })
    .pipe(gulp.dest('build'));

  return gulp.src('./iconic/**/*')
    .pipe(gulp.dest('build/assets/img/iconic/'));
});

// Copy page templates and generate routes
gulp.task('copy:templates', ['copy'], function() {
  var config = [];

  return gulp.src('./docs/templates/**/*.html')
    .pipe(dynamicRouting({
      path: 'build/assets/js/routes.js',
      root: 'docs'
    }))
    .pipe(markdown())
    .pipe(highlight())
    .pipe(gulp.dest('./build/templates'))
  ;
});

// Copy Foundation directive partials
gulp.task('copy:partials', ['clean:partials'], function() {
  return gulp.src(['js/angular/partials/**.*'])
    .pipe(gulp.dest('./build/partials/'));
});

gulp.task('css', ['sass'], function() {
  //copy css
  var dirs = [
    'bower_components/allmighty-autocomplete/style/autocomplete.css',
    'build/assets/css/app.css'
  ];
  return gulp.src(dirs)
    .pipe(concat('app.css'))
    .pipe(gulp.dest('build/assets/css'))
  ;

});

// 4. STYLESHEETS
// - - - - - - - - - - - - - - -

// Compile stylesheets with Ruby Sass
gulp.task('sass', function() {
  return sass('docs/assets/scss/', {
      loadPath: ['scss'],
      style: 'nested',
      bundleExec: true
    })
    .on('error', function(e) {
      console.log(e);
    })
    .pipe(autoprefixer({
      browsers: ['last 2 versions', 'ie 10']
    }))
    .pipe(gulp.dest('./build/assets/css/'));
});

// Compile stylesheets with node-sass
gulp.task('node-sass', function() {
  return gulp.src('docs/assets/scss/app.scss')
    .pipe(nodeSass({
      includePaths: ['scss'],
      outputStyle: 'nested',
      errLogToConsole: true
    }))
    .pipe(autoprefixer({
      browsers: ['last 2 versions', 'ie 10']
    }))
    .pipe(concat('app_node.css'))
    .pipe(gulp.dest('./build/assets/css/'));
});

// 5. JAVASCRIPT
// - - - - - - - - - - - - - - -

// Compile Foundation JavaScript
gulp.task('javascript', function() {
  var libs = [
    'bower_components/fastclick/lib/fastclick.js',
    'bower_components/viewport-units-buggyfill/viewport-units-buggyfill.js',
    'bower_components/tether/tether.js',
    'bower_components/angular/angular.js',
    'bower_components/angular-animate/angular-animate.js',
    'bower_components/ui-router/release/angular-ui-router.js',
    'bower_components/marked/lib/marked.js',
    'bower_components/angular-highlightjs/angular-highlightjs.js',
    'bower_components/highlightjs/highlight.pack.js',
    'bower_components/allmighty-autocomplete/script/autocomplete.js',
    'js/vendor/**/*.js',
    'js/angular/**/*.js'
  ];

  return gulp.src(libs)
    .pipe(uglify({
      beautify: true,
      mangle: false
    }).on('error', function(e) {
      console.log(e);
    }))
    .pipe(concat('foundation.js'))
    .pipe(gulp.dest('./build/assets/js/'))
  ;
});

// Compile documentation-specific JavaScript
gulp.task('javascript:docs', function() {
  var libs = [
    'docs/assets/js/app.js'
  ];

  return gulp.src(libs)
    .pipe(uglify({
      beautify: true,
      mangle: false
    }))
    .pipe(concat('app.js'))
    .pipe(gulp.dest('./build/assets/js/'))
  ;

});

// 6. SERVER
// - - - - - - - - - - - - - - -

gulp.task('server:start', function() {
  connect.server({
    root: './build',
    middleware: function() {
      return [
        modRewrite(['^[^\\.]*$ /index.html [L]'])
      ];
    },
  });
});

// 7. TESTING
// - - - - - - - - - - - - - - -

gulp.task('karma:test', ['build', 'node-sass'], function() {
  var testFiles = [
    'build/assets/js/app.js',
    'build/assets/js/angular-app.js',
    'bower_components/angular-mocks/angular-mocks.js',
    'bower_components/jsdiff/diff.js',
    'build/assets/css/app.css',
    'build/assets/css/app_node.css',
    'tests/unit/common/*Spec.js'
  ];

  return gulp.src(testFiles)
    .pipe(karma({
      configFile: 'karma.conf.js',
      action: 'run'
    }))
    .on('error', function(err) {
      throw err;
    })
  ;

});

gulp.task('test', ['karma:test'], function() {
  console.log('Tests finished.');
});

// 8. DEPLOYMENT
// - - - - - - - - - - - - - - -

// Deploy documentation
gulp.task('deploy', ['build'], function() {
  return gulp.src('build/**')
    .pipe(rsync({
      root: 'build',
      hostname: 'deployer@72.32.134.77',
      destination: '/home/deployer/sites/foundation-apps/current'
    }));
});

// Deploy to CDN
gulp.task('deploy:cdn', function() {
  var libs = [
    'bower_components/fastclick/lib/fastclick.js',
    'bower_components/viewport-units-buggyfill/viewport-units-buggyfill.js',
    'bower_components/tether/tether.js',
    'bower_components/angular/angular.js',
    'bower_components/angular-animate/angular-animate.js',
    'bower_components/ui-router/release/angular-ui-router.js',
    'js/vendor/**/*.js',
    'js/angular/**/*.js'
  ];

  var js = gulp.src(libs)
    .pipe(uglify())
    .pipe(concat('foundation.js'));
  var css = sass('scss/', {
    sourcemap: false, style: 'compressed'
  });

  merge(js, css)
    .pipe(gulp.dest('./test'));
});

// 9. NOW BRING IT TOGETHER
// - - - - - - - - - - - - - - -

// Build the documentation once
gulp.task('build', function(cb) {
  runSequence('clean', ['copy', 'copy:partials', 'css', 'javascript', 'uglify:docs'], 'copy:templates', function() {
    console.log('Successfully built.');
    cb();
  });
});

// Build the documentation, start a test server, and re-compile when files change
gulp.task('default', ['build', 'server:start'], function() {
  // Watch static files
  gulp.watch(['./docs/**/*.*', '!./docs/templates/**/*.*', '!./docs/assets/{scss,js}/**/*.*'], ['copy']);

  // Watch Angular templates
  gulp.watch(['docs/templates/**/*.html'], ['copy:templates']);

  // Watch Angular partials
  gulp.watch(['js/angular/partials/**.*'], ['copy:partials']);

  // Watch Sass
  gulp.watch(['./docs/assets/scss/**/*', './scss/**/*'], ['css']);

  // Watch JavaScript
  gulp.watch(['./docs/assets/js/**/*', './js/**/*'], ['javascript']);
});
