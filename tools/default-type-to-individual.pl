#!/usr/bin/perl

use strict;

use JSON;

my $host = "localhost:5984";
my $database = "family_test";

my @docs = map { $_->{'value'} } @{from_json(`curl -s -X GET $host/$database/_design/app/_view/docs`)->{'rows'}};

foreach my $doc (@docs) {

    my $id = $doc->{'_id'};
    print "\nProcessing doc $id\n";

    if ($doc->{'type'} ne 'individual' and $doc->{'_id'} ne 'html') {
      
        print "Doc type: $doc->{'type'}\n"; 
        print "Defaulting doc " . $id . " to type: individual\n";
        $doc->{'type'} = "individual";
        
        my $json_data = to_json($doc);
        $json_data =~ s/'/\\'/g;
        # TODO: this curl statement breaks on docs with notes
        #print $json_data;
        `curl -X PUT $host/$database/$id -d \'$json_data\'`;
    }

}

