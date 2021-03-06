/*
    sassdown
    github.com/nopr/sassdown
    ------------------------
    Copyright (c) 2013 Jesper Hills, contributors
    Some rights reserved
*/
'use strict';

module.exports = function (grunt) {

    // Handlebars helpers
    require('./libs/helpers').init();

    // Required libs
    var Sassdown = require('./libs/sassdown');

    // Grunt-registered Task
    // =====================
    grunt.registerMultiTask('sassdown', function() {

        // Store configuration options
        Sassdown.config = {
           // cwd: this.data.cwd,
           // dest: this.data.dest,
            opts: this.options({
                readme: true,
                theme: null,
                template: null,
                baseUrl: null,
                excludeMissing: false,
                commentStart: /\/\*/,
                commentEnd: /\*\//
            }),
            files: this.files,
            groups: {},
            module: module.filename
        };

        // Subtask: Init (expose module and grunt)
        Sassdown.init(grunt);

        // Subtask: Template, Theme
        grunt.verbose.subhead('Compile the Handlebars template:');
        Sassdown.template();
        Sassdown.theme();

        // Subtask: Files, Groups, Scaffold
        grunt.verbose.subhead('Read and parse contents of source files:');
        Sassdown.files();
        Sassdown.groups();
        Sassdown.scaffold();

        // Subtask: Assets
        grunt.verbose.subhead('Add assets to the results output:');
        Sassdown.assets();

        // Subtask: Indexing
        grunt.verbose.subhead('Generate index from Readme.md:');
        Sassdown.readme();

        // Subtask: Tree
        Sassdown.tree();

        // Subtask: Output
        grunt.verbose.subhead('Write styleguide copies of source files:');
        Sassdown.config.files.forEach(function(file){
            Sassdown.output(file);
        });

        // Finish: Notify user of completion
        grunt.verbose.or.ok('Styleguide created: ' + this.files[0].orig.dest);

    });

};
