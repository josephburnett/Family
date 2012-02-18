#!/usr/bin/perl

use strict;

use JSON;
use File::Slurp;

my $host = "localhost:5984";
my $database = "family_test";

my @docs = map { $_->{'value'} } @{from_json(`curl -s -X GET $host/$database/_design/app/_view/docs`)->{'rows'}};

foreach my $doc (@docs) {

    my $id = $doc->{'_id'};

    if ($doc->{'type'} eq 'individual') {
     
        delete $doc->{'parents'};
        delete $doc->{'parent'};

        my $json_data = to_json($doc);
        write_file("/tmp/doc", $json_data);
        `curl -X PUT $host/$database/$id --data-binary \@/tmp/doc`;
    }

}

