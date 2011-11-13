

var family_text = (function () {

    var default_id = '8a1769e242963d6252f192a3b905b124';
    var suppressed_fields = { parents: true, partners: true, _rev: true, name: true, _id: true };
    var default_name = 'someone';

    function clear() {
        $('#title').html('loading...');
        $('#individual').html('<ul></ul>');
        $('#partners').html('<ul></ul>');
        $('#parents').html('<ul></ul>');
        $('#siblings').html('<ul></ul>');
        $('#children').html('<ul></ul>');
    }

    function field_list(doc) {
        var list = "";
        for (var i in doc) {
            if (!suppressed_fields[i]) {
                list += '<li>' + i + ' : ' + doc[i] + '</li>';
            }
        }
        return $('<ul>' + list + '</ul>');
    }

    function doc_list(docs) {
        var list = $('<ul></ul>');
        for (var i in docs) {
            var entry = $('<li class="link">' + docs[i].name + '</li>');
            entry[0].uuid = docs[i]._id;
            entry.click(function() {
                load(this.uuid);
                family_graph.render(this.uuid);
                family_menu.load(this.uuid);
            });
            list.append(entry);
        }
        return list;
    }

    function load(uuid, skip_state) {

        if (!skip_state) { push_state(uuid); }

        family_cache.get_family({ uuid: uuid, callback: function(family) {
            clear();
            var individual = family.partners.shift();
            $('#title').html(individual.name);
            $('#individual').append(field_list(individual));
            $('#partners').append(doc_list(family.partners));
            $('#parents').append(doc_list(family.parents));
            $('#siblings').append(doc_list(family.siblings.slice(1)));
            $('#children').append(doc_list(family.children));
        }});
    }

    function push_state(uuid) {
        history.pushState({ uuid: uuid }, uuid, 'family.html?uuid='+uuid);
    }

    window.onpopstate = function(e) { 
        if (e.state && e.state.uuid) { 
            load(e.state.uuid, true);
            family_graph.render(e.state.uuid);
            family_menu.load(e.state.uuid);
        }
    };

    return { 
        load: function(id) { load(id); },
        init: function() {
            var match = /id=(\w{32})/.exec(window.location.href);
            if (match && match[1]) {
                load(match[1], true);
                family_graph.render(match[1]);
                family_menu.load(match[1]);
            } else {
                load(default_id);
                family_graph.render(default_id);
                family_menu.load(default_id);
            }
        }
    };  

})();





var family_graph = (function() {

    $.couch.urlPrefix = 'http://localhost:5984';
    var db = $.couch.db('family');

    var default_id = '8a1769e242963d6252f192a3b905b124';

    var paper;

    var width = 500;
    var center = width/2;

    var height = 500;
    var top = height/6;
    var middle = height/2;
    var bottom = (height/6)*5;

    var radius = 28;

    $(function() {
        paper = Raphael(500,0,width,height);
    });

    function linkedInitials(doc, x, y) {
        var text = paper.text(x, y, initials(doc));
        text.node.uuid = doc._id;
        text.node.onclick = function() { 
            renderUuid(this.uuid);
            family_text.load(this.uuid);
            family_menu.load(this.uuid);
        }
        //$(text.node).addClass('link');
        return text;
    }

    function drawNode(docs, x, y, fillColor, showChildrenDots, showParentsDots) {

        if (docs == undefined || docs[0] == undefined) {
            return; 
        }

        var set = paper.set();

        if (docs.length == 1) {
            var circle = paper.circle(x,y,radius);
            circle.attr({ fill: fillColor || "#FFF" });
            set.push( circle );
            if (showChildrenDots) {
                set.push( paper.text(x, y+radius+10, "...") );
            }
            if (showParentsDots) {
                set.push( paper.text(x, y-radius-15, "...") );
            }
        } 

        else if (docs.length == 2) {
            set.push( 
                paper.path("M"+(x-radius)+" "+y+
                           "A "+radius+" "+radius+" 0 1 1 "+(x+radius)+" "+y+
                           "L"+(x-radius)+" "+y)
                .attr({ fill: fillColor || "#FFF" }),
                paper.path("M"+(x+radius)+" "+y+
                           "A "+radius+" "+radius+" 0 1 1 "+(x-radius)+" "+y)
                .attr({ fill: "#FFF" })
            );
            if (showChildrenDots) {
                set.push( paper.text(x, y+radius+10, "...") );
            }
            if (showParentsDots) {
                set.push( paper.text(x, y-radius-15, "...") );
            }
        } 

        else {
            var ext = (docs.length-2) * 14;
            set.push(
                paper.path("M"+(x-radius)+" "+y+
                           "A "+radius+" "+radius+" 0 1 1 "+(x+radius)+" "+y+
                           "L"+(x-radius)+" "+y)
                .attr({ fill: fillColor || "#FFF" }),
                paper.path("M"+(x+radius)+" "+y+
                           "L"+(x+radius)+" "+(y+ext)+
                           "A "+radius+" "+radius+" 0 1 1 "+(x-radius)+" "+(y+ext)+
                           "L"+(x-radius)+" "+y)
                .attr({ fill: "#FFF" })
            );
            if (showChildrenDots) {
                set.push( paper.text(x, y+radius+ext+10, "...") );
            }
            if (showParentsDots) {
                set.push( paper.text(x, y-radius-15, "...") );
            }
        }

        if (docs.length == 1) {
            set.push(linkedInitials(docs[0], x, y));
        }
        
        else if (docs.length == 2) {
            set.push( 
                linkedInitials(docs[0], x, y-radius*0.40),
                linkedInitials(docs[1], x, y+radius*0.40)
            );
        }

        else if (docs.length > 2) {
            var ext = (docs.length-2) * 14;
            set.push(
                linkedInitials(docs[0], x, y-radius*0.40)
            );
            for (var i = 1; i < docs.length; i++) {
                var offset = 14 * (i-1);
                set.push(linkedInitials(docs[i], x, y+radius*0.40 + offset));
            }
        }

        set.x = x;
        set.y = y;
        set.uuid = docs[0]._id;

        return set;
    }

    function connect(a, b) {

        if (a == undefined || b == undefined) { return; }

        var line = paper.path("M"+(a.x).toString()+" "+(a.y).toString()+
                              "L"+(b.x).toString()+" "+(b.y).toString());
        line.toBack();
    }

    function drawChildren(children, parentNode, y) {
        var drawn_children = [];
        var interval = width / children.length;
        for (var i in children) {
            var node = drawNode(children[i].partners, interval*i + interval/2, y, false, children[i].drawChildrenDots)
            drawn_children.push(node);
            connect(node, parentNode);
        }
        return drawn_children;
    }

    function initials(doc) {
        return doc['name'].split(' ')[0];
        //return doc['name'].substr(0,3);
    }

    function renderUuid(uuid) {
        family_cache.get_family({ uuid: uuid, callback: function(docs) {

            paper.clear();

            var siblings_docs = [];
            for (var i in docs.sibling_partners) {
                siblings_docs.push({ partners: docs.sibling_partners[i], drawChildrenDots: docs.sibling_children[i].length > 0 });
            }

            var drawParentsDots = false;
            for (var i in docs.parents) {
                if (docs.parents[i].partners && docs.parents[i].partners.length > 0)
                    drawParentsDots = true;
            }

            var siblings = drawChildren(siblings_docs, drawNode(docs.parents, center, top, undefined, false, drawParentsDots), middle);

            var children_docs = [];
            for (var i in docs.children_partners) {
                children_docs.push({ partners: docs.children_partners[i], drawChildrenDots: docs.grand_children[i].length > 0 });
            }

            for (var i in siblings) {
                if (siblings[i].uuid == uuid) {
                    siblings[i].remove();
                    drawChildren(children_docs, drawNode(docs.partners, siblings[i].x, middle, "#fffebf"), bottom);
                }
            }
        }});
    }

    return {
        render: function(uuid) { renderUuid(uuid); },
    }

})();


var family_menu = (function() {

    var default_name = "someone";

    function set_gender(params) {
        var uuid = params.uuid;
        var gender = params.gender;
        family_cache.get({ uuid: uuid, callback: function(doc) {
            doc.gender = gender;
            family_cache.put({ doc: doc, callback: function() {
                window.location.reload();
            }});
        }});
    }

    function add_partner(params) {
        var uuid = params.uuid;
        if (uuid == undefined) { return; }
        family_cache.get({ uuid: uuid, callback: function(doc) {
            var new_partner = { name: default_name, partners: [ uuid ] };
            family_cache.put({ doc: new_partner, callback: function(new_doc) {
                if (doc.partners) {
                    doc.partners.push(new_doc._id);
                } else {
                    doc.partners = [ new_doc._id ];
                }
                family_cache.put({ doc: doc, callback: function() {
                    window.location.reload();
                }});
            }});
        }});
    }

    function add_child(params) {
        var uuid = params.uuid;
        var partner_uuid = params.partner_uuid;
        var new_child = { name: default_name, parents: [ uuid, partner_uuid ] };
        family_cache.put({ doc: new_child, callback: function() {
            window.location.reload();
        }});
    }

    function add_parents(params) {
        var uuid = params.uuid;
        // create parent 1
        family_cache.put({ doc: { name: default_name }, callback: function(parent_1) {
            // create parent 2
            family_cache.put({
                doc: { name: default_name, partners: [ parent_1._id ] },
                callback: function(parent_2) {
                    // update parent 1
                    parent_1.partners = [ parent_2._id ];
                    family_cache.put({ doc: parent_1, callback: function() {
                        // update individual
                        family_cache.get({ uuid: uuid, callback: function(doc) {
                            if (doc.parents) {
                                doc.parents.push(parent_1._id);
                                doc.parents.push(parent_2._id);
                            } else {
                                doc.parents = [ parent_1._id, parent_2._id ];
                            }
                            family_cache.put({ doc: doc, callback: function() {
                                window.location.reload();
                            }});
                        }});
                    }});
                }
            });
        }});
    }

    function edit_document(params) {
        var uuid = params.uuid;
        var url = "http://127.0.0.1:5984/_utils/document.html?family/" + uuid;
        window.open(url);
    }

    function first_name(doc) {
        return doc.name.split(' ')[0];
    }

    function link(f, p, element, caption) {
        var text = $('<'+element+' class="link">'+caption+'</'+element+'>');
        text[0].p = p;
        text[0].f = f;
        text.click(function() {
            this.f(this.p);
        });
        return text;
    }

    function clear() {
        $('#menu').html('<ul></ul>');
    }

    function load(uuid) {
        family_cache.get_family({ uuid: uuid, callback: function(family) {

            clear();
            var menu = $('<ul></ul>');
            var individual = family.partners.shift();

            // parents
            if (individual.parents == undefined) {
                menu.append(link(
                    add_parents, { uuid: uuid },
                    "li", "Add parents of "+first_name(individual)
                ));
            }
            
            // partners
            menu.append(link(add_partner, { uuid: uuid }, "li", "Add new partner"));
            
            // children
            for (var i in family.partners) {
                menu.append(link(
                    add_child, { uuid: uuid, partner_uuid: family.partners[i]._id },
                    "li", "Add child with "+first_name(family.partners[i])
                ));
            }

            // gender
            if (individual.gender == undefined) {
                var item = $('<li><span>Identify '+first_name(individual)+' as: </span></li>');
                item.append(link(
                    set_gender, { uuid: uuid, gender: "male" },
                    "span", "male"
                ));
                item.append($('<span> / </span>'));
                item.append(link(
                    set_gender, { uuid: uuid, gender: "female" },
                    "span", "female"
                ));
                menu.append(item);
            }

            // document
            menu.append(link(edit_document, { uuid: uuid }, "li", "Edit document directly"));

            $('#menu').append(menu);

        }});
    }

    return {
        load: function(uuid) { load(uuid); }
    }

})();



var family_cache = (function() {

    $.couch.urlPrefix = 'http://localhost:5984';
    var db = $.couch.db('family');

    var doc_cache = {};
    var children_id_cache = {};

    function put(p) {
    
        var doc = p.doc;
        var uuid = doc._id;
        var callback = p.callback;

        var entry = get_doc_cache_entry(uuid);

        // existing unlocked document
        if (entry && !entry.lock) {
            entry.lock = true;
            if (callback) { entry.callbacks.push(callback); }
            db.saveDoc(doc, { success: function() {
                doc_cache_miss(entry);
            }});
        }
        // existing locked document
        else if (entry && entry.lock) {
            db.saveDoc(doc, { success: function() {
                if (callback) { entry.callbacks.push(callback); }
                // unlock happened during save
                if (!entry.lock) {
                    entry.lock = true;
                    doc_cache_miss(entry);
                }
            }});
        }
        // new document
        else {
            db.saveDoc(doc, { success: function(response) {
                entry = get_doc_cache_entry(response.id);
                entry.lock = true;
                if (callback) { entry.callbacks.push(callback); }
                doc_cache_miss(entry);
            }});
        }

        // i don't really know what's changed
        // but the page usually refreshes
        //children_id_cache = {};
    }

    function get_doc_cache_entry(uuid) {
        if (uuid == undefined) { return; }
        if (doc_cache[uuid]) { return doc_cache[uuid]; }
        doc_cache[uuid] = {
            uuid: uuid,
            lock: false,
            callbacks: [],
            doc: undefined
        };
        return doc_cache[uuid];
    }

    function get(p) {

        var uuid = p.uuid;
        var callback = p.callback;

        if (uuid == undefined) { 
            if (callback) { callback(null); }
            return;
        }

        var entry = get_doc_cache_entry(uuid);

        if (entry.lock) {
            if (callback) { entry.callbacks.push(callback); }
        } else if (entry.doc) {
            if (callback) { callback(entry.doc); }
        } else {
            if (callback) { entry.callbacks.push(callback); }
            entry.lock = true;
            doc_cache_miss(entry);
        }
    }   

    function get_children(p) {

        var uuid = p.uuid;
        var callback = p.callback;        

        if (uuid == undefined) { 
            if (callback) { callback(null); }
            return;
        }

        var entry = children_id_cache[uuid];
        if (entry == undefined) {
            children_id_cache[uuid] = entry = {
                uuid: uuid,
                lock: false,
                callbacks: [],
                children_ids: undefined
            };
        }

        if (entry.lock) {
            if (callback) { entry.callbacks.push(callback); }
        } else if (entry.children_ids) {
            if (callback) { assemble(entry.children_ids, callback); }
        } else {
            if (callback) { entry.callbacks.push(callback); }
            entry.lock = true;
            children_id_cache_miss(entry);
        }
    }

    function doc_cache_miss(entry) {

        db.openDoc(entry.uuid, { success: function(doc) {
            entry.doc = doc;
            entry.lock = false;
            var locked_callbacks = [];
            for (var i in entry.callbacks) {
                locked_callbacks.push(entry.callbacks[i]);
            }            
            entry.callbacks = [];
            for (var i in locked_callbacks) {
                locked_callbacks[i](doc);
            }
        }});
    }

    function children_id_cache_miss(entry) {

        db.view('app/children_ids?key="' + entry.uuid + '"', { success: function(data) {
            entry.children_ids = ids = [];
            for (var i in data.rows) {
                ids.push(data.rows[i].value);
            }
            assemble(ids, function(children) {
                entry.lock = false;
                var locked_callbacks = [];
                for (var i in entry.callbacks) {
                    locked_callbacks.push(entry.callbacks[i]);
                }            
                entry.callbacks = [];
                for (var i in locked_callbacks) {
                    locked_callbacks[i](children);
                }
            });
        }});
    }
    
    function assemble(uuid, callback) {
        var f = [];
        for (var i in uuid) {
            f.push({ f: get, params: { uuid: uuid[i] } });
        }
        async_align(f, function(docs) { callback(docs); });
    }

    function get_family(p) {

        var id = p.uuid;
        var callback = p.callback;
        family_cache.get({ uuid: id, callback: function(doc) {

            var f = [];
            if (doc.partners) {
                for (var i in doc.partners) {
                    f.push({ f: get, params: { uuid: doc.partners[i] } });
                }
            }
            if (doc.parents) {
                for (var i in doc.parents) {
                    f.push({ f: get, params: { uuid: doc.parents[i] } });
                    f.push({ f: get_children, params: { uuid: doc.parents[i] } });
                }
            }
            f.push({ f: family_cache.get_children, params: { uuid: doc._id } });
            async_align(
                f, function(values) {

                    var docs = {
                        partners:          [],
                        parents:           [],
                        siblings:          [],
                        sibling_children:  [],
                        sibling_partners:  [],
                        children:          [],
                        grand_children:    [],
                        children_partners: [],
                    };

                    var i,j,start = 0;
                    var unique_siblings = [];

                    docs.partners.push(doc);
                    if (doc.partners) {
                        for (i = start; i < start + doc.partners.length; i++) {
                            docs.partners.push(values[i]);
                        }
                        start = i;
                    }
                    if (doc.parents) {
                        for (i = start; i < start + (doc.parents.length * 2); i++) {
                            docs.parents.push(values[i++]);
                            if (values[i]) {
                                for (j = 0; j < values[i].length; j++) {
                                    var id = values[i][j]._id;
                                    unique_siblings[id] = values[i][j];
                                }
                            }
                        }
                        start = i;
                    }
                    for (j = 0; j < values[start].length; j++) {
                        docs.children.push(values[start][j]);
                    }

                    docs.siblings.push(doc);
                    for (var i in unique_siblings) {
                        if (unique_siblings[i]._id != doc._id)
                            docs.siblings.push(unique_siblings[i]);
                    }

                    // Get grandchildren and sibling children
                    var g = [];
                    for (var i in docs.siblings) {
                        g.push({ f: get_children, params: { uuid: docs.siblings[i]._id } });
                        for (var j in docs.siblings[i].partners) {
                            g.push({ f: get, params: { uuid: docs.siblings[i].partners[j] } });
                        }
                    }
                    for (var i in docs.children) {
                        g.push({ f: get_children, params: { uuid: docs.children[i]._id } });
                        for (var j in docs.children[i].partners) {
                            g.push({ f: get, params: { uuid: docs.children[i].partners[j] } });
                        }
                    }

                    async_align(
                        g, function(values) {

                            var index = 0;

                            for (var i = 0; i < docs.siblings.length; i++) {
                                docs.sibling_children[i] = values[index++];
                                docs.sibling_partners[i] = [];
                                docs.sibling_partners[i].push(docs.siblings[i]);
                                if (docs.siblings[i].partners) {
                                    for (var j = 0; j < docs.siblings[i].partners.length; j++) {
                                        docs.sibling_partners[i].push(values[index++]);
                                    }
                                }
                            }

                            for (var i = 0; i < docs.children.length; i++) {
                                docs.grand_children[i] = values[index++];
                                docs.children_partners[i] = [];
                                docs.children_partners[i].push(docs.children[i]);
                                if (docs.children[i].partners) {
                                    for (var j = 0; j < docs.children[i].partners.length; j++) {
                                        docs.children_partners[i].push(values[index++]);
                                    }
                                }
                            }

                            DEBUG_FAMILY = docs;

                            if (callback) { callback(docs); }
                        }
                    );
                }
            );
        }});
    }

    return {
        get: function(p) { get({ uuid: p.uuid, callback: p.callback }); },
        get_children: function(p) { get_children({ uuid: p.uuid, callback: p.callback }); },
        get_family: function(p) { get_family({ uuid: p.uuid, callback: p.callback }); },
        put: function(p) { put({ doc: p.doc, callback: p.callback }); }
    };

})();


function async_align(async_functions, callback) {

    if (async_functions.length == 0) { callback( [] ); return; }
    var n = 0;
    var values = {};
    for (var i in async_functions) {
        var job = async_functions[i];
        async_call({ f: job.f, params: job.params, index: i });
    }
    function async_call(p) {
        p.params.callback = function(value) {
            values[p.index] = value;
            done();
        }
        p.f(p.params);
    }
    function done() {
        n += 1;
        if (n == async_functions.length) {
            var return_values = [];
            for (var i = 0; i < async_functions.length; i++) {
                return_values.push(values[i]);
            }
            callback(return_values);
        }
    }
}






