'use strict';

const path = require('path'),
      mod_path = path.join('.', 'node_modules'),
      bin_path = path.join(mod_path, '.bin'),
      nyc_path = path.join(bin_path, 'nyc'),
      test_path = path.resolve('test') + path.sep;

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
                bail: true,
                clearRequireCache: true,
                clearCacheFilter: f => !f.startsWith(test_path)
            }
        },

        copy: {
            sqlite_db: {
                src: 'atributo.empty.sqlite3',
                dest: 'test/atributo.sqlite3'
            }
        },

        env: {
            pg: {
                // Note: On Ubuntu, this requires adding a mapping to
                // /etc/postgresql/11/main/pg_ident.conf, for example:
                //
                // foo foo postgres
                //
                // and specifying the map in etc/postgresql/11/main/pg_hba.conf:
                //
                // local all postgres peer map=moose
                ATRIBUTO_TEST_DB_TYPE: 'pg'
            }
        },

        exec: {
            cover: {
                cmd: nyc_path + " -x Gruntfile.js -x \"" + path.join('test', '**') + "\" node " + grunt_path + " test-all-db"
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
            },

            clear_pg: {
                cmd: "psql -U postgres -d atributo -c \"DELETE FROM allocations;\" -c \"DELETE from instances;\""
            }
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-env');

    grunt.registerTask('reset', 'Reset DB', function ()
    {
        let task;

        switch (process.env.ATRIBUTO_TEST_DB_TYPE)
        {
        case 'pg':
            task = 'exec:clear_pg';
            break;

        default:
            task = 'copy:sqlite_db'
            break;
        }

        grunt.task.run(task);
    });

    grunt.registerTask('lint', 'eslint');
    grunt.registerTask('test', ['reset',
                                'mochaTest:default']);
    grunt.registerTask('test-multi', ['reset',
                                      'mochaTest:multi_sp',
                                      'reset',
                                      'mochaTest:multi_mp']);
    grunt.registerTask('test-example', ['reset',
                                        'mochaTest:example',
                                        'reset',
                                        'mochaTest:example2']);
    grunt.registerTask('test-all', ['test', 'test-multi', 'test-example']);
    grunt.registerTask('test-all-db', ['test-all',
                                       'env:pg',
                                       'test-all']);
    grunt.registerTask('coverage', ['exec:cover',
                                    'exec:cover_report',
                                    'exec:cover_check']);
    grunt.registerTask('coveralls', 'exec:coveralls');
    grunt.registerTask('docs', 'exec:documentation');
    grunt.registerTask('serve_docs', 'exec:serve_documentation');
    grunt.registerTask('default', ['lint', 'test']);
};
