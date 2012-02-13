#!/usr/bin/perl

use strict;

use JSON;
use Date::Parse;
use Date::Format;

my $host = "localhost:5984";
my $database = "family";

#my @partnerships = map { $_->{'key'} } @{from_json(`curl -s -X GET $host/$database/_design/app/_view/partnerships?group_level=2`)->{'rows'}};
my @individuals = map { $_->{'value'} } @{from_json(`curl -s -X GET $host/$database/_design/app/_view/docs`)->{'rows'}};

my %families;
my %individuals = map { $_->{'_id'} => $_ } @individuals;

sub familyId {
    my ($id1, $id2) = @_;
    if ($id1 gt $id2) {
        return "$id1" . "$id2";
    } else {
        return "$id2" . "$id1";
    }
}

sub formatDate {
    my ($date) = @_;
    
}

# Generate families
foreach my $doc (@individuals) {
    my $id = $doc->{'_id'};
    my $name = $doc->{'name'};
    my $partners = $doc->{'partners'};

    if ($id eq 'html' or $name eq '______') { next; }

    # Each partnership is a family
    if ($partners) {
        foreach (@$partners) {
            my $familyId = familyId($id,$_);
            unless ($families{$familyId}) {
                $families{$familyId} = {
                    'HUSB' => $id, # TODO check gender
                    'WIFE' => $_,  #
                    'CHIL' => [],
                };
            }
        }
    }
}

# Put children in the families
foreach my $doc (@individuals) {
    my $id = $doc->{'_id'};
    my $parents = $doc->{'parents'};    

    # Each individual with two parents is part of a family
    if ($parents and @$parents == 2) {
        my $familyId = familyId($parents->[0],$parents->[1]);
        if ($families{$familyId}) {
            push @{$families{$familyId}->{'CHIL'}}, $id;
        }
    }
}

# Printe header
print "0 HEAD\n";
print "1 GEDC\n";
print "2 VERS 5.5\n";

# Print individuals
foreach my $doc (@individuals) {
    my $id = $doc->{'_id'};
    my $name = $doc->{'name'};
    my $partners = $doc->{'partners'};
    my $parents = $doc->{'parents'};
    my $gender = $doc->{'gender'};
    my $birthDate = $doc->{'birth_date'};

    if ($id eq 'html' or $name eq '______') { next; }

    print "0 \@$id\@ INDI\n";
    print "1 NAME $name\n";
    if ($gender) { print "1 SEX " . (($gender eq 'male') ? "M" : "F") . "\n"; }
    # if ($birthDate) {
    #    print "1 BIRT\n";
    #    ($ss,$mm,$hh,$day,$month,$year,$zone) = strptime($birthDate);
    #    print "2 DATE $birthDate\n" # TODO parse date and print DD MMM YYYY
    #}

    if ($partners) {
        foreach (@$partners) {
            print "1 FAMS \@" . familyId($id,$_) . "\@\n";
        }
    }

    if ($parents and @$parents == 2) {
        print "1 FAMC \@". familyId($parents->[0],$parents->[1]) ."\@\n";
    }
}

# Print families
foreach my $familyId (keys %families) {
    my $family = $families{$familyId};
    my $husband = $family->{'HUSB'};
    my $wife = $family->{'WIFE'};
    my $children = $family->{'CHIL'};

    print "0 \@$familyId\@ FAM\n";
    print "1 HUSB \@$husband\@\n";
    print "1 WIFE \@$wife\@\n";
    print "1 MARR\n";
    foreach (@$children) {
        print "1 CHIL \@$_\@\n";
    }
}

# Print trailer
print "0 TRLR\n";


