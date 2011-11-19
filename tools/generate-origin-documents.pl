#!/usr/bin/perl

use strict;

use JSON;
use Date::Parse;
use Date::Format;

my $host = "localhost:5984";
my $database = "family_test";

my @individuals = map { $_->{'value'} } @{from_json(`curl -s -X GET $host/$database/_design/app/_view/docs`)->{'rows'}};

my %origin_documents;
my %individuals = map { $_->{'_id'} => $_ } @individuals;

sub uuid {
    return from_json(`curl -s -X GET $host/_uuids`)->{'uuids'}->[0];
}

sub origin_key {
    my ($id1, $id2) = @_;
    if ($id1 gt $id2) {
        return "$id1" . "$id2";
    } else {
        return "$id2" . "$id1";
    }
}

sub doc_link {
    return "http://$host/_utils/document.html?$database/@_";
}

# Generate origin documents with parents
foreach my $doc (@individuals) {
    my $id = $doc->{'_id'};
    my $name = $doc->{'name'};
    my $partners = $doc->{'partners'};

    # Each partnership is an origin document
    if ($partners) {
        foreach (@$partners) {
            my $key = origin_key($id,$_);
            unless ($origin_documents{$key}) {
                $origin_documents{$key} = { 
                    _id => uuid(),
                    type => "origin",
                    parents => [ 
                        { uuid => $id }, 
                        { uuid => $_ } 
                    ],
                    nature => 'marriage'
                };
            }
        }
    }
}

# Add children to origin documents
foreach my $doc (@individuals) {
    my $id = $doc->{'_id'};
    my $name = $doc->{'name'};
    my $parents = $doc->{'parents'}; 

    # Each individual with two parents is part of a family
    if ($parents and @$parents == 2) {
        my $key = origin_key($parents->[0],$parents->[1]);
        my $origin_doc = $origin_documents{$key};
        if ($origin_doc) {
            
            my $child = { uuid => $id, nature => 'biological' };

            if ($origin_doc->{'children'}) {
                push @{$origin_doc->{'children'}}, $child;
            } else {
                $origin_doc->{'children'} = [ $child ];
            }

        } else {
            die "ERROR: $name (" . doc_link($id) . ") has parents with no origin document\n";
        }
    } elsif ($parents) {
        die "ERROR: $name (" . doc_link($id) . ") has an invalid set of parents\n";
    }
}

foreach (keys %origin_documents) {
    my $uuid = $origin_documents{$_}->{'_id'};
    my $json_data = to_json($origin_documents{$_});
    print "Uploading origin document: $uuid\n";
    print "$json_data\n";
    #`curl -X PUT $host/$database/$uuid -d \'$json_data\'`;
}
