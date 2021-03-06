/*
    sassdown
    github.com/nopr/sassdown
    ------------------------
    Copyright (c) 2013 Jesper Hills, contributors
    Some rights reserved
*/
'use strict';

// Exposing global vars
// =====================
var Sassdown, grunt;

// Required Node modules
// =====================
var fs = require('fs');
var path = require('path');
var cssmin = require('cssmin');
var prismjs = require('./prism');
var markdown = require('marked');
var Handlebars = require('handlebars');

// Quick utility functions
// =======================
function warning   (message) { return grunt.verbose.warn(message); }
function uncomment (comment, opts) {
    return comment.replace(new RegExp(opts.commentStart.source + '|' + opts.commentEnd.source, 'g'), '').trim();
}
function unindent  (comment) { return comment.trim().replace(/^\*/, '').replace(/\n \* |\n \*|\n /g, '\n').replace(/\n   /g, '\n    '); }
function fromroot  (resolve) { return path.relative(path.dirname(), resolve); }
function fromdata  (resolve) { return fromroot(path.resolve(module.filename, '..', '..', 'data', resolve)); }

// Exported methods
// ===========================
module.exports.init = function (_grunt) {
    grunt = _grunt;
    Sassdown = this;
};

module.exports.template = function () {
    // If option was left blank, use
    // the plugin default version
    if (!Sassdown.config.opts.template) {
        warning('User template not specified. Using default.');
        Sassdown.config.opts.template = fromdata('template.hbs');
    }
    // Return Sassdown.config.template object
    Sassdown.config.template = {
        html: Handlebars.compile(grunt.file.read(Sassdown.config.opts.template)),
        assets: null
    };
    return Sassdown.config.template;
};

module.exports.assets = function () {
    // Check if we added includes option
    if (!Sassdown.config.opts.assets) {
        warning('No assets specified');
    } else {
        // Create empty listing
        var assets = '';
        // Loop through matches
        grunt.file.expand(Sassdown.config.opts.assets).forEach(function(file){
            // Write <link> or <script> tag to include
            if (file.split('.').pop() === 'css') { assets += '<link rel="stylesheet" href="/'+file+'" />'; }
            if (file.split('.').pop() === 'js') { assets += '<script src="/'+file+'"><\\/script>'; }
            // Output a read
            grunt.file.read(file);
        });
        // Register as partial
        Handlebars.registerPartial('assets', assets);
    }
};

module.exports.scaffold = function () {
    // Create the destination directory
    grunt.file.mkdir(path.resolve(Sassdown.config.files[0].orig.dest));
    // Resolve the relative 'root' of the cwd as we will need this later
    Sassdown.config.root = fromroot(path.resolve(Sassdown.config.files[0].orig.cwd, '..'));
};

module.exports.theme = function () {
    // If option is blank, use plugin default
    if (!Sassdown.config.opts.theme) {
        warning('User stylesheet not specified. Using default.');
        Sassdown.config.opts.theme = fromdata('theme.css');
    }
    // Assign theme and prism to respective Handlebars partials
    Handlebars.registerPartial('theme', '<style>'+cssmin(grunt.file.read(Sassdown.config.opts.theme))+'</style>');
    Handlebars.registerPartial('prism', '<script>'+grunt.file.read(fromdata('prism.js'))+'</script>');
};

module.exports.groups = function () {
    // Add file data into groups
    Sassdown.config.files.forEach(function(file){
        // Create if it does not exist
        if (!Sassdown.config.groups[file.group]) {
            Sassdown.config.groups[file.group] = {
                name: file.group,
                pages: []
            };
        }
        // Push file data
        Sassdown.config.groups[file.group].pages.push({
            heading: file.heading,
            group: file.group,
            path: file.path,
            url: file.url
        });
    });
    return Sassdown.config.groups;
};

module.exports.metadata = function (file, page, opts) {
    var regexp = new RegExp(
        opts.commentStart.source +
        '([\\\s\\\S]*?)' +
        opts.commentEnd.source,
        'g'
    );
    var sect, sections = [];
    // Assign metadata properties to file object
    file.slug     = path.basename(page._path, path.extname(page._path));
    file.group    = path.dirname(page._path).split(path.sep)[0];
    file.path     = file.dest.replace(path.extname(page._path), '.html');
    file.url      = opts.baseUrl ? file.path.replace(file.orig.dest, opts.baseUrl) : '/' + file.path;
    file.original = file.src[0];
    file.site     = {};
    file.sections = [];
    //replace sigle line comments like `/* a comment */` with SASS-like syntax
    //TODO: needs a better fix
    page._src = page._src.replace(/\/\*([^\n]*)\*\//g, '//$1');
    //file.sections = page._src.match(/\/\*([\s\S]*?)\*\//g);
    while((sect = regexp.exec(page._src)) !== null) {
        sections.push(sect);
    }
    //processing sections =
    file.sections = sections.map(function (el, index, a) {
        //captured string sect[0]
        //first group sect[1]
        var nextEl = a[index + 1];
        var nextIndex = nextEl ? nextEl.index : page._src.length;
        var cssSrc = page._src.slice( el.index + el[0].length, nextIndex ).trim();

        if (typeof el[1] === 'string') {
            el[1] = el[1].trim();
        }

        el.cssSrc = cssSrc;

        return el;

    });
    if (file.sections.length) {
        //extract first line, remove markdown and normalize
        page._name =  file.sections[0][1].split('\n').shift().replace(/^[\s#\*]+/, '').trim();
    }

    file.heading  = (typeof page._name === 'string' && page._name.length) ? page._name : file.slug;
    //file.sections = sections;//page._src.match(regexp);
    // Get rid of some object literal clutter
    //delete file.orig;
    //delete file.dest;
    //delete file.src;
    // Return file back
    return file;
};

module.exports.files = function () {
    // Modify attributes for each file
    Sassdown.config.files = Sassdown.config.files.map(function(file){
        // Page references
        var page = {};
        var src = '';

        page._path = path.relative(file.orig.cwd, file.src[0]);
        page._src  = grunt.file.read(file.src);

        src = unindent(uncomment(page._src, Sassdown.config.opts));

        page._name = null;
        // MOVED TO METADATApage._name = (markdown(src).match('<h1')) ? markdown(src).split('</h1>')[0].split('>')[1] : null;
        // Add properties to file and use node path on
        // page object for consistent file system resolving
        file = module.exports.metadata(file, page, Sassdown.config.opts);
        // Throw any errors
        if (!file.sections.length || !file.heading) {
            if (Sassdown.config.opts.excludeMissing) {
                return null;
            } else {
                module.exports.errors(file);
            }
        }
        // Format the content sections
        if (file.sections) { module.exports.sections(file, Sassdown.config); }
        return file;
    }).filter(function (file) {
        return file !== null;
    });
    // Return back
    return Sassdown.config.files;
};

module.exports.errors = function () {
    if (!file.sections) {
        // Could not find any sections
        warning('Comment missing');
        grunt.verbose.or.warn('Comment missing: '+file.original);
    }
    if (file.sections) {
        // Found sections
        grunt.verbose.ok('Comment found');
        if (!file.heading) {
            // Could not find a heading
            warning('Heading missing');
            grunt.verbose.or.warn('Heading missing: '+file.original);
        }
        if (file.heading) {
            // Found a heading
            grunt.verbose.ok('Heading found');
        }
    }
};

module.exports.sections = function (file) {
    // Loop through any sections (comments) in file
    file.sections.forEach(function(sectionObj, index){
        // Remove CSS comment tags and any SASS-style
        // comment block indentation at line beginnings
        var rawMarkdown = unindent(sectionObj[1], Sassdown.config.opts).trim();

        // See if any ```-marked or 4-space indented code blocks exist
        if (/    |```/.test(rawMarkdown)) {
            // Encapsulate and mark the code block
            if (rawMarkdown.indexOf('```') !== -1) {
                rawMarkdown = rawMarkdown.replace(/```/, '[html]\n```');
            } else if (rawMarkdown.indexOf('    ') !== -1) {
                rawMarkdown = rawMarkdown.replace(/    /, '[html]\n    ');
            }
            // Return our sections object
            file.sections[index] = {
                id: Math.random().toString(36).substr(2,5),
                comment: markdown(rawMarkdown.split('[html]')[0]),
                source: markdown(rawMarkdown.split('[html]\n')[1]),
                result: rawMarkdown.split('[html]\n')[1].replace(/     |    |```/g, '').replace(/(\r\n|\n|\r)/gm,'')
            };
        } else {
            // Without code, it is just a comment
            file.sections[index] = {
                comment: markdown(rawMarkdown)
            };
        }
        if (sectionObj.cssSrc.length  > 0) {
            file.ext = file.prismLang = path.extname(file.src[0]).slice(1);
            if (file.ext === 'sass') {
                file.prismLang = 'scss';
            }
            file.sections[index].prismLang = file.prismLang;
            file.sections[index].fileExt = file.ext;
            file.sections[index].cssSource = '<pre><code>' + sectionObj.cssSrc + '</code></pre>';
        }
    });

};

module.exports.readme = function () {
    // Resolve the relative path to readme
    var readme = Sassdown.config.opts.readme;

    if (typeof readme === 'string') {
        readme = grunt.config.process(readme);
    }
    if (readme === true) {
        // Readme.md not found, create it:
        readme = fromroot(path.resolve(Sassdown.config.root, 'readme.md'));
        if (!grunt.file.exists(readme)) {
            warning('Readme file not found. Create it.');
            grunt.file.write(readme, 'Styleguide\n==========\n\nFill me with your delicious readme content\n');
            grunt.verbose.or.ok('Readme file created: '+Sassdown.config.root+'/readme.md');
        }
    }

    // Create a file object
    var file = {};
    // Fill it with data for an index
    file.slug     = 'index';
    file.heading  = 'Home';
    file.group    = '';
    file.path     = fromroot(path.resolve(Sassdown.config.files[0].orig.dest, 'index.html'));
    file.site     = {};

    if (readme && grunt.file.isFile(readme)) {
        file.original = readme;
        file.sections = [{
            comment: markdown(grunt.file.read(readme))
        }];
        // Output the file
    } else {
        file.original = null;
        file.sections = [{
            comment: '<h1>Styleguide Index</h1>'
        }];
    }
    Sassdown.output(file);
};

module.exports.recurse = function (filepath) {
    // Match a directory or file name
    var match = fs.lstatSync(filepath);
    // Simple metadata for the file tree
    var tree  = {
        name: path.basename(filepath),
        path: filepath,
        type: null,
        data: {}
    };
    // Check if filepath match is a directory
    if (match.isDirectory()) {
        // Assign type
        tree.type = 'dir';
        // Add children to the tree
        tree.children = fs.readdirSync(filepath).map(function(child) {
            // Run the tree function again for this child
            return module.exports.recurse(filepath + '/' + child, Sassdown.config);
        });
    }
    // If the filepath isn't a directory, try
    // and grab file data from the Sassdown.config.files
    // object and associate it
    if (match.isFile()) {
        // Assign type
        tree.type = 'file';
        // Go through all the Sassdown.config.files
        Sassdown.config.files.map(function(file) {
            // See if the tree path matches the original file path
            if (tree.path === file.original) {
                // Return file object to tree.data
                tree.data = file;
            }
        });
    }
    // Return the tree object
    return tree;
};

module.exports.tree = function () {
    // Set the Sassdown.config.tree to be the returned object literal
    // from the file directory recursion
    Sassdown.config.tree = module.exports.recurse(Sassdown.config.files[0].orig.cwd, Sassdown.config);
    // Return the complete tree
    return Sassdown.config.tree;
};

module.exports.output = function (file) {
    // Site rather than page-specific data
    file.site.root    = Sassdown.config.files[0].orig.dest;
    file.site.rootUrl = path.normalize( Sassdown.config.opts.baseUrl || ('/' + Sassdown.config.files[0].orig.dest));
    file.site.groups  = Sassdown.config.groups;
    file.site.assets  = '/'+file.site.root+'assets';
    // Write out to path with grunt
    return grunt.file.write(
        file.path,
        Sassdown.config.template.html({
            page: file,
            config: Sassdown.config
        })
    );
};
