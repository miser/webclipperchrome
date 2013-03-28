describe('MKSyncTaskQueue', function() {
    describe('#getErrorContentHTML()', function() {


        function getErrorTips(notes) {
            var str = '';
            for (var i = 0; i < notes.length; i++) {
                str += "<li>"+ notes[i].title+ " 剪辑出错，是否需要 <a href='javascript:void(0)' class='repeat-btn' data-guid='"+ notes[i].guid+ "'>重试</a>  <a href='javascript:void(0)' class='cancel-btn' data-guid='"+ notes[i].guid+ "'>放弃</a></li>";
            }
            return "<ul class='error-tips'>" + str + "</ul>"
        }

        beforeEach(function(done) {
            MKSyncTaskQueue.clearError();
            done();
        })
        it('no addError', function() {
            var html = MKSyncTaskQueue.getErrorContentHTML();
            html.should.equal("")
        })

        it('add a error', function() {
            var note = {
                title: '测试',
                sourceurl: 'http://notelocal.sdo.com',
                notecontent: 'test',
                tags: 'test_tag'
            }
            var state = new MKEvent();
            var mkNote = new MkSyncNode(note, null, state);

            MKSyncTaskQueue.addError(mkNote);

            var html = MKSyncTaskQueue.getErrorContentHTML();
            html.should.equal(getErrorTips([note.title]));
        })

        it('add two error', function() {
            var note1 = {
                title: '测试1',
                sourceurl: 'http://notelocal.sdo.com',
                notecontent: 'test',
                tags: 'test_tag',
                guid:String.createGuid()
            }
            var note2 = {
                title: '测试2',
                sourceurl: 'http://notelocal.sdo.com',
                notecontent: 'test',
                tags: 'test_tag',
                guid:String.createGuid()
            }
            var state1 = new MKEvent();
            var state2 = new MKEvent();
            var mkNote1 = new MkSyncNode(note1, null, state1);
            var mkNote2 = new MkSyncNode(note2, null, state2);

            MKSyncTaskQueue.addError(mkNote1);
            MKSyncTaskQueue.addError(mkNote2);

            var html = MKSyncTaskQueue.getErrorContentHTML();
            html.should.equal(getErrorTips([note1, note2]));
        })
    })
})