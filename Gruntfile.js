'use strict';

const path = require('path'),
      mod_path = path.join('.', 'node_modules'),
      bin_path = path.join(mod_path, '.bin'),
      nyc_path = path.join(bin_path, 'nyc');

let grunt_path;

if (process.platform === 'win32')
{
    grunt_path = path.join(mod_path, 'grunt', 'bin', 'grunt');
}
else
{
    grunt_path = path.join(bin_path, 'grunt');
}

module.exports = function (grunt)
{
    grunt.initConfig(
    {
        eslint: {
            target: [ 'Gruntfile.js', 'index.js', 'doc-extra.js', 'test/**/*.js' ]
        },

        mochaTest: {
            default: {
                src: 'test/test.js'
            },
            multi_sp: {
                src: 'test/multi_sp.js'
            },
            multi_mp: {
                src: 'test/multi_mp.js'
            },
            example: {
                src: 'test/run_example.js'
            },
            example2: {
                src: 'test/run_example2.js'
            },
            options: {
                bail: true
            }
        },

        copy: {
            db: {
                src: 'atributo.empty.sqlite3',
                dest: 'test/atributo.sqlite3'
            }
        },

        exec: {
            cover: {
                cmd: nyc_path + " -x Gruntfile.js -x \"" + path.join('test', '**') + "\" node " + grunt_path + " test-all"
            },

            cover_report: {
                cmd: nyc_path + ' report -r lcov'
            },

            cover_check: {
                cmd: nyc_path + ' check-coverage --statements 100 --branches 100 --functions 100 --lines 100'
            },

            coveralls: {
                cmd: 'cat coverage/lcov.info | ./node_modules/.bin/coveralls'
            },

            documentation: {
                cmd: './node_modules/.bin/documentation build -c documentation.yml -f html -o docs index.js doc-extra.js'
            },

            serve_documentation: {
                cmd: './node_modules/.bin/documentation serve -w -c documentation.yml index.js doc-extra.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('lint', 'eslint');
    grunt.registerTask('test', ['copy:db',
                                'mochaTest:default']);
    grunt.registerTask('test-multi', ['copy:db',
                                      'mochaTest:multi_sp',
                                      'copy:db',
                                      'mochaTest:multi_mp']);
    grunt.registerTask('test-example', ['copy:db',
                                        'mochaTest:example',
                                        'copy:db',
                                        'mochaTest:example2']);
    grunt.registerTask('test-all', ['test', 'test-multi', 'test-example']);
    grunt.registerTask('coverage', ['exec:cover',
                                    'exec:cover_report',
                                    'exec:cover_check']);
    grunt.registerTask('coveralls', 'exec:coveralls');
    grunt.registerTask('docs', 'exec:documentation');
    grunt.registerTask('serve_docs', 'exec:serve_documentation');
    grunt.registerTask('default', ['lint', 'test']);
};
