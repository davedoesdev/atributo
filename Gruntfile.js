module.exports = function (grunt)
{
    grunt.initConfig(
    {
        eslint: {
            target: [ 'index.js', 'test/**/*.js' ]
        },

        mochaTest: {
            src: 'test/*.js',
            options: {
                bail: true
            }
        },

        copy: {
            db: {
                src: 'atributo.empty.sqlite3',
                dest: 'test/atributo.sqlite3'
            }
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('lint', 'eslint');
    grunt.registerTask('test', ['copy:db',
                                'mochaTest']);

};
